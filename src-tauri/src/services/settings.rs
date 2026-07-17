use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::constants::{
    DEFAULT_INSTANCE_URL, DEFAULT_STABLE_FILE_MS, MAX_STABLE_FILE_MS, MIN_STABLE_FILE_MS,
    MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH,
};
use crate::services::atomic_json::write_atomic;
use crate::services::url_validation::{default_instance_url, validate_instance_url};
use crate::services::watcher_paths::{normalize_path, paths_equal};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PostUploadAction {
    Delete,
    MoveToUploaded,
    MoveToCustom,
}

impl Default for PostUploadAction {
    fn default() -> Self {
        Self::MoveToUploaded
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentUploadOptions {
    #[serde(default = "default_seed")]
    pub seed: u8,
    #[serde(default = "default_true")]
    pub allow_zip: bool,
    #[serde(default)]
    pub as_queued: bool,
    #[serde(default)]
    pub add_only_if_cached: bool,
}

fn default_seed() -> u8 {
    1
}

fn default_true() -> bool {
    true
}

impl Default for TorrentUploadOptions {
    fn default() -> Self {
        Self {
            seed: 1,
            allow_zip: true,
            as_queued: false,
            add_only_if_cached: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderWatcherConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub watch_path: Option<String>,
    #[serde(default)]
    pub post_upload_action: PostUploadAction,
    #[serde(default)]
    pub custom_move_path: Option<String>,
    #[serde(default)]
    pub torrent_options: TorrentUploadOptions,
    #[serde(default)]
    pub scan_existing_on_enable: bool,
    #[serde(default = "default_stable_file_ms")]
    pub stable_file_ms: u64,
}

fn default_stable_file_ms() -> u64 {
    DEFAULT_STABLE_FILE_MS
}

impl Default for FolderWatcherConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            watch_path: None,
            post_upload_action: PostUploadAction::MoveToUploaded,
            custom_move_path: None,
            torrent_options: TorrentUploadOptions::default(),
            scan_existing_on_enable: false,
            stable_file_ms: DEFAULT_STABLE_FILE_MS,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PathAllowlist {
    #[serde(default)]
    watch_paths: Vec<String>,
    #[serde(default)]
    move_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraySettings {
    #[serde(default = "default_close_to_tray")]
    pub close_to_tray: bool,
    #[serde(default)]
    pub minimize_to_tray: bool,
    #[serde(default)]
    pub start_hidden: bool,
}

fn default_close_to_tray() -> bool {
    true
}

impl Default for TraySettings {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            minimize_to_tray: false,
            start_hidden: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    #[serde(default = "default_true")]
    pub native_notifications: bool,
    #[serde(default = "default_true")]
    pub notify_on_upload_success: bool,
    #[serde(default = "default_true")]
    pub notify_on_upload_failure: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            native_notifications: true,
            notify_on_upload_success: true,
            notify_on_upload_failure: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowGeometry {
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub x: Option<i32>,
    #[serde(default)]
    pub y: Option<i32>,
}

impl WindowGeometry {
    pub fn clamped_size(&self) -> Option<(u32, u32)> {
        let width = self.width?;
        let height = self.height?;
        Some((
            width.max(MIN_WINDOW_WIDTH),
            height.max(MIN_WINDOW_HEIGHT),
        ))
    }

    pub fn from_physical(
        width: u32,
        height: u32,
        x: i32,
        y: i32,
    ) -> Self {
        Self {
            width: Some(width.max(MIN_WINDOW_WIDTH)),
            height: Some(height.max(MIN_WINDOW_HEIGHT)),
            x: Some(x),
            y: Some(y),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    #[serde(default = "default_instance_url")]
    pub instance_url: String,
    #[serde(default)]
    pub credential_last_updated_at: Option<String>,
    #[serde(default)]
    pub folder_watcher: FolderWatcherConfig,
    #[serde(default)]
    pub launch_at_login: bool,
    #[serde(default)]
    pub tray: TraySettings,
    #[serde(default)]
    pub notifications: NotificationSettings,
    #[serde(default)]
    path_allowlist: PathAllowlist,
    #[serde(default)]
    pub window_geometry: WindowGeometry,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            instance_url: default_instance_url(),
            credential_last_updated_at: None,
            folder_watcher: FolderWatcherConfig::default(),
            launch_at_login: false,
            tray: TraySettings::default(),
            notifications: NotificationSettings::default(),
            path_allowlist: PathAllowlist::default(),
            window_geometry: WindowGeometry::default(),
        }
    }
}

pub struct SettingsService {
    path: PathBuf,
    settings: Mutex<DesktopSettings>,
}

impl SettingsService {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create app data dir: {e}"))?;
        let path = dir.join("desktop-settings.json");
        let settings = if path.exists() {
            let raw =
                fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DesktopSettings::default()
        };
        Ok(Self {
            path,
            settings: Mutex::new(settings),
        })
    }

    pub fn app_data_dir(&self) -> &Path {
        self.path
            .parent()
            .expect("desktop settings path must have a parent directory")
    }

    pub fn get_instance_url(&self) -> String {
        self.settings
            .lock()
            .map(|s| s.instance_url.clone())
            .unwrap_or_else(|_| DEFAULT_INSTANCE_URL.to_string())
    }

    pub fn set_instance_url(&self, url: String) -> Result<String, String> {
        let normalized = validate_instance_url(&url)?;
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.instance_url = normalized.clone();
        self.persist(&settings)?;
        Ok(normalized)
    }

    pub fn get_credential_last_updated_at(&self) -> Option<String> {
        self.settings
            .lock()
            .ok()
            .and_then(|s| s.credential_last_updated_at.clone())
    }

    pub fn set_credential_last_updated_at(&self, value: Option<String>) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.credential_last_updated_at = value;
        self.persist(&settings)
    }

    pub fn get_launch_at_login(&self) -> bool {
        self.settings
            .lock()
            .map(|s| s.launch_at_login)
            .unwrap_or(false)
    }

    pub fn set_launch_at_login(&self, enabled: bool) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.launch_at_login = enabled;
        self.persist(&settings)
    }

    pub fn get_tray_settings(&self) -> TraySettings {
        self.settings
            .lock()
            .map(|s| s.tray.clone())
            .unwrap_or_default()
    }

    pub fn set_tray_settings(&self, tray: TraySettings) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.tray = tray;
        self.persist(&settings)
    }

    pub fn get_window_geometry(&self) -> WindowGeometry {
        self.settings
            .lock()
            .map(|s| s.window_geometry.clone())
            .unwrap_or_default()
    }

    pub fn set_window_geometry(&self, geometry: WindowGeometry) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.window_geometry = geometry;
        self.persist(&settings)
    }

    pub fn get_notification_settings(&self) -> NotificationSettings {
        self.settings
            .lock()
            .map(|s| s.notifications.clone())
            .unwrap_or_default()
    }

    pub fn set_notification_settings(
        &self,
        notifications: NotificationSettings,
    ) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.notifications = notifications;
        self.persist(&settings)
    }

    pub fn should_start_hidden(&self) -> bool {
        let settings = self.settings.lock().ok();
        settings
            .map(|s| s.launch_at_login && s.tray.start_hidden)
            .unwrap_or(false)
    }

    pub fn get_folder_watcher_config(&self) -> FolderWatcherConfig {
        self.settings
            .lock()
            .map(|s| s.folder_watcher.clone())
            .unwrap_or_default()
    }

    pub fn set_folder_watcher_config(&self, config: FolderWatcherConfig) -> Result<(), String> {
        self.validate_folder_watcher_for_start(&config)?;

        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;

        settings.folder_watcher = config;
        self.persist(&settings)
    }

    pub fn disable_folder_watcher(&self) -> Result<(), String> {
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;
        settings.folder_watcher.enabled = false;
        self.persist(&settings)
    }

    pub fn validate_folder_watcher_for_start(
        &self,
        config: &FolderWatcherConfig,
    ) -> Result<(), String> {
        let settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;

        if let Some(ref watch_path) = config.watch_path {
            self.ensure_watch_path_allowed(&settings.path_allowlist, watch_path)?;
            normalize_path(watch_path)?;
        }

        if config.post_upload_action == PostUploadAction::MoveToCustom {
            let custom = config
                .custom_move_path
                .as_ref()
                .ok_or("Custom move path is required for moveToCustom action")?;
            self.ensure_move_path_allowed(&settings.path_allowlist, custom)?;
        }

        if config.stable_file_ms < MIN_STABLE_FILE_MS || config.stable_file_ms > MAX_STABLE_FILE_MS {
            return Err(format!(
                "stableFileMs must be between {MIN_STABLE_FILE_MS} and {MAX_STABLE_FILE_MS}"
            ));
        }

        if config.torrent_options.seed > 2 {
            return Err("seed must be 0, 1, or 2".into());
        }

        Ok(())
    }

    pub fn register_watch_path_from_picker(&self, path: &str) -> Result<String, String> {
        let normalized = normalize_path(path)?;
        let normalized_str = normalized.to_string_lossy().to_string();
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;

        if !settings
            .path_allowlist
            .watch_paths
            .iter()
            .any(|existing| paths_equal(existing, &normalized_str))
        {
            settings.path_allowlist.watch_paths.push(normalized_str.clone());
            self.persist(&settings)?;
        }

        Ok(normalized_str)
    }

    pub fn register_move_path_from_picker(&self, path: &str) -> Result<String, String> {
        let normalized = normalize_path(path)?;
        let normalized_str = normalized.to_string_lossy().to_string();
        let mut settings = self
            .settings
            .lock()
            .map_err(|_| "Settings lock poisoned".to_string())?;

        if !settings
            .path_allowlist
            .move_paths
            .iter()
            .any(|existing| paths_equal(existing, &normalized_str))
        {
            settings.path_allowlist.move_paths.push(normalized_str.clone());
            self.persist(&settings)?;
        }

        Ok(normalized_str)
    }

    fn ensure_watch_path_allowed(
        &self,
        allowlist: &PathAllowlist,
        path: &str,
    ) -> Result<(), String> {
        if allowlist
            .watch_paths
            .iter()
            .any(|allowed| paths_equal(allowed, path))
        {
            Ok(())
        } else {
            Err("Watch folder must be selected through the native folder picker".into())
        }
    }

    fn ensure_move_path_allowed(&self, allowlist: &PathAllowlist, path: &str) -> Result<(), String> {
        if allowlist
            .move_paths
            .iter()
            .any(|allowed| paths_equal(allowed, path))
        {
            Ok(())
        } else {
            Err("Move destination must be selected through the native folder picker".into())
        }
    }

    fn persist(&self, settings: &DesktopSettings) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to encode settings: {e}"))?;
        write_atomic(&self.path, &raw)
    }
}

#[cfg(test)]
impl SettingsService {
    pub(crate) fn new_for_test(dir: &Path) -> Self {
        let path = dir.join("desktop-settings.json");
        Self {
            path,
            settings: Mutex::new(DesktopSettings::default()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_settings_service() -> (SettingsService, PathBuf) {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tbm-settings-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        let service = SettingsService::new_for_test(&dir);
        (service, dir)
    }

    #[test]
    fn window_geometry_clamps_below_minimum_size() {
        let geometry = WindowGeometry {
            width: Some(400),
            height: Some(300),
            x: Some(10),
            y: Some(20),
        };
        assert_eq!(geometry.clamped_size(), Some((MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)));
    }

    #[test]
    fn window_geometry_from_physical_clamps_size() {
        let geometry = WindowGeometry::from_physical(400, 300, 10, 20);
        assert_eq!(geometry.width, Some(MIN_WINDOW_WIDTH));
        assert_eq!(geometry.height, Some(MIN_WINDOW_HEIGHT));
        assert_eq!(geometry.x, Some(10));
        assert_eq!(geometry.y, Some(20));
    }

    #[test]
    fn validate_rejects_unallowlisted_watch_path() {
        let (service, dir) = temp_settings_service();
        let config = FolderWatcherConfig {
            watch_path: Some("/tmp/not-allowlisted".to_string()),
            ..Default::default()
        };
        let error = service
            .validate_folder_watcher_for_start(&config)
            .unwrap_err();
        assert!(error.contains("native folder picker"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_accepts_allowlisted_watch_path() {
        let (service, dir) = temp_settings_service();
        let registered = service.register_watch_path_from_picker(&dir.to_string_lossy()).unwrap();
        let config = FolderWatcherConfig {
            watch_path: Some(registered),
            ..Default::default()
        };
        service
            .validate_folder_watcher_for_start(&config)
            .unwrap();
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_rejects_invalid_stable_file_ms() {
        let (service, dir) = temp_settings_service();
        let registered = service.register_watch_path_from_picker(&dir.to_string_lossy()).unwrap();
        let config = FolderWatcherConfig {
            watch_path: Some(registered),
            stable_file_ms: 100,
            ..Default::default()
        };
        let error = service
            .validate_folder_watcher_for_start(&config)
            .unwrap_err();
        assert!(error.contains("stableFileMs"));
        let _ = fs::remove_dir_all(dir);
    }
}
