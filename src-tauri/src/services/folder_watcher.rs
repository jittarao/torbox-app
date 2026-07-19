use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{async_runtime::JoinHandle, AppHandle, Emitter, Manager};
use tokio::sync::mpsc;

use crate::services::credentials::read_api_key;
use crate::services::settings::{SettingsService, WatchRule};
use crate::services::upload_queue::ProcessedFingerprintStore;
use crate::services::watcher_batch::run_watcher_event_loop;
use crate::services::watcher_paths::{
    normalize_path, resolve_rule_id_for_file_path, should_ignore_watched_file, uploaded_subdir,
};

pub(crate) const EVENT_WATCHER_STATUS: &str = "desktop://watcher-status-changed";
pub(crate) const EVENT_TORRENT_DETECTED: &str = "desktop://torrent-detected";
pub(crate) const EVENT_UPLOAD_QUEUED: &str = "desktop://upload-queued";
pub(crate) const EVENT_UPLOAD_SUCCEEDED: &str = "desktop://upload-succeeded";
pub(crate) const EVENT_UPLOAD_FAILED: &str = "desktop://upload-failed";

const SHUTDOWN_JOIN_TIMEOUT_SECS: u64 = 5;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchRuleStatus {
    pub rule_id: String,
    pub watch_path: Option<String>,
    pub enabled: bool,
    pub active: bool,
    pub queue_depth: usize,
    pub uploads_today: u32,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherStatus {
    pub running: bool,
    pub queue_depth: usize,
    pub last_error: Option<String>,
    pub uploads_today: u32,
    pub rules: Vec<WatchRuleStatus>,
}

#[derive(Default)]
struct RuleRuntimeState {
    queue_depth: usize,
    uploads_today: u32,
    last_error: Option<String>,
}

struct WatcherRuntimeState {
    running: bool,
    session_generation: u64,
    active_rule_ids: HashSet<String>,
    path_to_rule: HashMap<PathBuf, String>,
    rule_states: HashMap<String, RuleRuntimeState>,
    queue_depth: usize,
    last_error: Option<String>,
    uploads_today: u32,
    uploads_today_date: Option<String>,
    in_flight: HashSet<String>,
    stop_tx: Option<mpsc::Sender<()>>,
    task_handle: Option<JoinHandle<()>>,
    watcher: Option<RecommendedWatcher>,
}

impl Default for WatcherRuntimeState {
    fn default() -> Self {
        Self {
            running: false,
            session_generation: 0,
            active_rule_ids: HashSet::new(),
            path_to_rule: HashMap::new(),
            rule_states: HashMap::new(),
            queue_depth: 0,
            last_error: None,
            uploads_today: 0,
            uploads_today_date: None,
            in_flight: HashSet::new(),
            stop_tx: None,
            task_handle: None,
            watcher: None,
        }
    }
}

pub struct FolderWatcherService {
    inner: Arc<FolderWatcherInner>,
}

pub(crate) struct FolderWatcherInner {
    pub(crate) app: AppHandle,
    pub(crate) settings: Arc<SettingsService>,
    pub(crate) processed: Arc<ProcessedFingerprintStore>,
    runtime: Mutex<WatcherRuntimeState>,
}

impl FolderWatcherService {
    pub fn new(app: AppHandle, settings: Arc<SettingsService>) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
        let processed = Arc::new(ProcessedFingerprintStore::new(&app_data_dir)?);

        Ok(Self {
            inner: Arc::new(FolderWatcherInner {
                app,
                settings,
                processed,
                runtime: Mutex::new(WatcherRuntimeState::default()),
            }),
        })
    }

    pub fn get_status(&self) -> WatcherStatus {
        build_watcher_status(&self.inner)
    }

    pub fn stop(&self) -> Result<(), String> {
        self.stop_internal(SHUTDOWN_JOIN_TIMEOUT_SECS)
    }

    pub fn shutdown(&self) {
        let _ = self.stop_internal(SHUTDOWN_JOIN_TIMEOUT_SECS);
    }

    fn stop_internal(&self, join_timeout_secs: u64) -> Result<(), String> {
        let (stop_tx, task_handle, generation) = {
            let mut runtime = self
                .inner
                .runtime
                .lock()
                .map_err(|_| "Watcher runtime lock poisoned".to_string())?;

            runtime.session_generation = runtime.session_generation.saturating_add(1);
            let generation = runtime.session_generation;
            let stop_tx = runtime.stop_tx.take();
            let task_handle = runtime.task_handle.take();
            runtime.watcher = None;
            runtime.running = false;
            runtime.active_rule_ids.clear();
            runtime.path_to_rule.clear();
            (stop_tx, task_handle, generation)
        };

        if let Some(tx) = stop_tx {
            let _ = tx.try_send(());
        }

        if let Some(handle) = task_handle {
            tauri::async_runtime::block_on(async {
                let _ = tokio::time::timeout(
                    Duration::from_secs(join_timeout_secs),
                    handle,
                )
                .await;
            });
        }

        if let Ok(mut runtime) = self.inner.runtime.lock() {
            if runtime.session_generation == generation {
                runtime.queue_depth = 0;
                runtime.in_flight.clear();
                for state in runtime.rule_states.values_mut() {
                    state.queue_depth = 0;
                }
            }
        }

        self.emit_status();
        Ok(())
    }

    pub fn start(&self, rules_to_scan: &[String]) -> Result<(), String> {
        let config = self.inner.settings.get_folder_watcher_config();
        if !config.has_enabled_rules() {
            return Err("No enabled watch rules".into());
        }

        for rule in config.rules.iter().filter(|rule| rule.enabled) {
            self.inner.settings.validate_watch_rule(rule)?;
        }

        read_api_key(&self.inner.settings).map_err(|_| {
            "Store your TorBox API key via Enable background features before starting the watcher"
                .to_string()
        })?;

        self.stop_internal(SHUTDOWN_JOIN_TIMEOUT_SECS)?;

        let enabled_rules: Vec<WatchRule> = config
            .rules
            .into_iter()
            .filter(|rule| rule.enabled)
            .collect();

        let session_generation = {
            let mut runtime = self
                .inner
                .runtime
                .lock()
                .map_err(|_| "Watcher runtime lock poisoned".to_string())?;
            runtime.session_generation = runtime.session_generation.saturating_add(1);
            runtime.session_generation
        };

        let (event_tx, event_rx) = mpsc::channel::<(String, PathBuf)>(64);
        let (stop_tx, stop_rx) = mpsc::channel::<()>(1);

        let mut path_to_rule: HashMap<PathBuf, String> = HashMap::new();
        for rule in &enabled_rules {
            let watch_path = rule
                .watch_path
                .as_ref()
                .ok_or("Enabled watch rules must have a watch folder")?;
            let normalized = normalize_path(watch_path)?;
            path_to_rule.insert(normalized, rule.id.clone());
        }

        let path_to_rule_for_notify = path_to_rule.clone();
        let notify_tx = event_tx.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) => {
                            for path in event.paths {
                                if let Some(rule_id) =
                                    resolve_rule_id_for_file_path(&path, &path_to_rule_for_notify)
                                {
                                    if notify_tx
                                        .try_send((rule_id, path))
                                        .is_err()
                                    {
                                        eprintln!(
                                            "[folder-watcher] Dropped file event: channel full"
                                        );
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create folder watcher: {e}"))?;

        for (watch_root, rule_id) in &path_to_rule {
            watcher
                .watch(watch_root, RecursiveMode::NonRecursive)
                .map_err(|e| format!("Failed to watch folder: {e}"))?;
            if let Ok(mut runtime) = self.inner.runtime.lock() {
                runtime.active_rule_ids.insert(rule_id.clone());
                runtime
                    .rule_states
                    .entry(rule_id.clone())
                    .or_default();
            }
        }

        {
            let mut runtime = self
                .inner
                .runtime
                .lock()
                .map_err(|_| "Watcher runtime lock poisoned".to_string())?;
            runtime.running = true;
            runtime.last_error = None;
            runtime.stop_tx = Some(stop_tx);
            runtime.watcher = Some(watcher);
            runtime.path_to_rule = path_to_rule;
            reset_uploads_today_if_needed(&mut runtime);
        }

        self.emit_status();

        if !rules_to_scan.is_empty() {
            let scan_ids: HashSet<&str> = rules_to_scan.iter().map(String::as_str).collect();
            for rule in &enabled_rules {
                if scan_ids.contains(rule.id.as_str()) {
                    scan_existing_for_rule(&event_tx, rule)?;
                }
            }
        }

        let inner = Arc::clone(&self.inner);
        let handle = tauri::async_runtime::spawn(async move {
            run_watcher_event_loop(inner, session_generation, event_rx, stop_rx).await;
        });

        if let Ok(mut runtime) = self.inner.runtime.lock() {
            runtime.task_handle = Some(handle);
        }

        Ok(())
    }

    pub fn try_auto_start(&self) -> Result<(), String> {
        let config = self.inner.settings.get_folder_watcher_config();
        if !config.has_enabled_rules() {
            return Ok(());
        }
        if read_api_key(&self.inner.settings).is_err() {
            return Ok(());
        }
        if config
            .rules
            .iter()
            .filter(|rule| rule.enabled)
            .any(|rule| self.inner.settings.validate_watch_rule(rule).is_err())
        {
            return Ok(());
        }
        self.start(&[])
    }

    fn emit_status(&self) {
        let status = self.get_status();
        let _ = self.inner.app.emit(EVENT_WATCHER_STATUS, status);
    }
}

fn scan_existing_for_rule(
    event_tx: &mpsc::Sender<(String, PathBuf)>,
    rule: &WatchRule,
) -> Result<(), String> {
    let watch_path = rule
        .watch_path
        .as_ref()
        .ok_or("Watch folder is not configured")?;
    let watch_root = PathBuf::from(watch_path);
    let uploaded_dir = uploaded_subdir(&watch_root);
    let custom_move = rule.custom_move_path.as_ref().map(PathBuf::from);
    if let Ok(entries) = fs::read_dir(&watch_root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file()
                && !should_ignore_watched_file(
                    &path,
                    &watch_root,
                    Some(&uploaded_dir),
                    custom_move.as_deref(),
                )
            {
                let _ = event_tx.try_send((rule.id.clone(), path));
            }
        }
    }
    Ok(())
}

pub(crate) fn is_session_active(inner: &FolderWatcherInner, session_generation: u64) -> bool {
    inner
        .runtime
        .lock()
        .map(|runtime| runtime.session_generation == session_generation)
        .unwrap_or(false)
}

fn reset_uploads_today_if_needed(runtime: &mut WatcherRuntimeState) {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    if runtime.uploads_today_date.as_deref() != Some(today.as_str()) {
        runtime.uploads_today = 0;
        runtime.uploads_today_date = Some(today);
        for state in runtime.rule_states.values_mut() {
            state.uploads_today = 0;
        }
    }
}

fn rule_state_mut<'a>(
    runtime: &'a mut WatcherRuntimeState,
    rule_id: &str,
) -> &'a mut RuleRuntimeState {
    runtime
        .rule_states
        .entry(rule_id.to_string())
        .or_default()
}

pub(crate) fn adjust_queue_depth(inner: &FolderWatcherInner, rule_id: &str, delta: i32) {
    if let Ok(mut runtime) = inner.runtime.lock() {
        let rule_state = rule_state_mut(&mut runtime, rule_id);
        if delta.is_negative() {
            rule_state.queue_depth = rule_state
                .queue_depth
                .saturating_sub(delta.unsigned_abs() as usize);
        } else {
            rule_state.queue_depth = rule_state.queue_depth.saturating_add(delta as usize);
        }

        if delta.is_negative() {
            runtime.queue_depth = runtime
                .queue_depth
                .saturating_sub(delta.unsigned_abs() as usize);
        } else {
            runtime.queue_depth = runtime.queue_depth.saturating_add(delta as usize);
        }
    }
    emit_status_from_inner(inner);
}

pub(crate) fn is_in_flight(inner: &FolderWatcherInner, fingerprint: &str) -> bool {
    inner
        .runtime
        .lock()
        .map(|runtime| runtime.in_flight.contains(fingerprint))
        .unwrap_or(false)
}

pub(crate) fn set_in_flight(inner: &FolderWatcherInner, fingerprint: &str, active: bool) {
    if let Ok(mut runtime) = inner.runtime.lock() {
        if active {
            runtime.in_flight.insert(fingerprint.to_string());
        } else {
            runtime.in_flight.remove(fingerprint);
        }
    }
}

pub(crate) fn record_success(inner: &FolderWatcherInner, rule_id: &str) {
    if let Ok(mut runtime) = inner.runtime.lock() {
        reset_uploads_today_if_needed(&mut runtime);
        runtime.uploads_today = runtime.uploads_today.saturating_add(1);
        runtime.last_error = None;
        let rule_state = rule_state_mut(&mut runtime, rule_id);
        rule_state.uploads_today = rule_state.uploads_today.saturating_add(1);
        rule_state.last_error = None;
    }
    emit_status_from_inner(inner);
}

pub(crate) fn record_move_failed(inner: &FolderWatcherInner, rule_id: &str, error: &str) {
    if let Ok(mut runtime) = inner.runtime.lock() {
        reset_uploads_today_if_needed(&mut runtime);
        runtime.uploads_today = runtime.uploads_today.saturating_add(1);
        runtime.last_error = Some(error.to_string());
        let rule_state = rule_state_mut(&mut runtime, rule_id);
        rule_state.uploads_today = rule_state.uploads_today.saturating_add(1);
        rule_state.last_error = Some(error.to_string());
    }
    emit_status_from_inner(inner);
}

pub(crate) fn record_failure(inner: &FolderWatcherInner, rule_id: &str, error: &str) {
    if let Ok(mut runtime) = inner.runtime.lock() {
        runtime.last_error = Some(error.to_string());
        let rule_state = rule_state_mut(&mut runtime, rule_id);
        rule_state.last_error = Some(error.to_string());
    }
    emit_status_from_inner(inner);
}

pub(crate) fn emit_status_from_inner(inner: &FolderWatcherInner) {
    let status = build_watcher_status(inner);
    let _ = inner.app.emit(EVENT_WATCHER_STATUS, status);
}

fn build_watcher_status(inner: &FolderWatcherInner) -> WatcherStatus {
    let runtime = inner
        .runtime
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    let config = inner.settings.get_folder_watcher_config();
    let rules = config
        .rules
        .iter()
        .map(|rule| {
            let state = runtime.rule_states.get(&rule.id);
            WatchRuleStatus {
                rule_id: rule.id.clone(),
                watch_path: rule.watch_path.clone(),
                enabled: rule.enabled,
                active: runtime.active_rule_ids.contains(&rule.id),
                queue_depth: state.map(|s| s.queue_depth).unwrap_or(0),
                uploads_today: state.map(|s| s.uploads_today).unwrap_or(0),
                last_error: state.and_then(|s| s.last_error.clone()),
            }
        })
        .collect();

    WatcherStatus {
        running: runtime.running,
        queue_depth: runtime.queue_depth,
        last_error: runtime.last_error.clone(),
        uploads_today: runtime.uploads_today,
        rules,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reset_uploads_today_on_new_day() {
        let mut runtime = WatcherRuntimeState {
            uploads_today: 5,
            uploads_today_date: Some("2000-01-01".to_string()),
            ..Default::default()
        };
        reset_uploads_today_if_needed(&mut runtime);
        assert_eq!(runtime.uploads_today, 0);
        assert_eq!(
            runtime.uploads_today_date,
            Some(chrono::Utc::now().format("%Y-%m-%d").to_string())
        );
    }
}
