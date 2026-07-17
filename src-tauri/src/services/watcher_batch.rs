use std::collections::{HashSet, VecDeque};
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::mpsc;
use tokio::task::JoinSet;
use tokio::time::{Instant, Sleep};

use crate::constants::{
    MAX_BATCH_UPLOADS_PER_REQUEST, WATCHER_BATCH_COALESCE_MS, WATCHER_BATCH_DRAIN_MS,
    WATCHER_MAX_RETRIES, WATCHER_RATE_LIMIT_MAX_RETRIES,
};
use crate::services::folder_watcher::{
    adjust_queue_depth, is_in_flight, is_session_active, record_failure,
    record_move_failed, record_success, set_in_flight, FolderWatcherInner,
    EVENT_TORRENT_DETECTED, EVENT_UPLOAD_FAILED, EVENT_UPLOAD_QUEUED, EVENT_UPLOAD_SUCCEEDED,
};
use crate::services::credentials::read_api_key;
use crate::services::settings::FolderWatcherConfig;
use crate::services::tbm_client::{
    sha256_hex, upload_torrent_batch_detailed, BatchItemResult, TorrentFileUpload,
};
use crate::services::upload_queue::{apply_post_upload_action, wait_for_stable_file};
use crate::services::watcher_paths::{should_ignore_watched_file, uploaded_subdir};
use crate::state::AppState;

struct ReadyTorrent {
    path: PathBuf,
    filename: String,
    bytes: Vec<u8>,
    fingerprint: String,
}

pub async fn run_watcher_event_loop(
    inner: Arc<FolderWatcherInner>,
    session_generation: u64,
    mut event_rx: mpsc::Receiver<PathBuf>,
    mut stop_rx: mpsc::Receiver<()>,
) {
    let mut pending: VecDeque<PathBuf> = VecDeque::new();
    let mut pending_keys: HashSet<String> = HashSet::new();
    let mut coalesce_deadline: Option<Instant> = None;
    let mut coalesce_sleep: Option<Pin<Box<Sleep>>> = None;

    loop {
        if coalesce_deadline.is_some() && coalesce_sleep.is_none() {
            if let Some(deadline) = coalesce_deadline {
                coalesce_sleep = Some(Box::pin(tokio::time::sleep_until(deadline)));
            }
        }

        tokio::select! {
            _ = stop_rx.recv() => break,
            maybe_path = event_rx.recv() => {
                if !is_session_active(&inner, session_generation) {
                    break;
                }
                match maybe_path {
                    Some(path) => {
                        enqueue_pending_path(&mut pending, &mut pending_keys, path);
                        coalesce_deadline = Some(Instant::now() + next_coalesce_delay(pending.len()));
                        coalesce_sleep = None;
                    }
                    None => break,
                }
            }
            _ = async {
                if let Some(sleep) = coalesce_sleep.as_mut() {
                    sleep.as_mut().await;
                }
            }, if coalesce_sleep.is_some() => {
                coalesce_sleep = None;
                if !is_session_active(&inner, session_generation) {
                    break;
                }
                flush_pending_batch(&inner, session_generation, &mut pending, &mut pending_keys).await;
                if pending.is_empty() {
                    coalesce_deadline = None;
                } else {
                    coalesce_deadline = Some(Instant::now() + Duration::from_millis(WATCHER_BATCH_DRAIN_MS));
                }
            }
        }
    }
}

fn enqueue_pending_path(
    pending: &mut VecDeque<PathBuf>,
    pending_keys: &mut HashSet<String>,
    path: PathBuf,
) {
    let key = path.to_string_lossy().to_string();
    if pending_keys.insert(key) {
        pending.push_back(path);
    }
}

fn next_coalesce_delay(pending_len: usize) -> Duration {
    if pending_len > MAX_BATCH_UPLOADS_PER_REQUEST {
        Duration::from_millis(WATCHER_BATCH_DRAIN_MS)
    } else {
        Duration::from_millis(WATCHER_BATCH_COALESCE_MS)
    }
}

pub(crate) fn take_batch_snapshot(
    pending: &mut VecDeque<PathBuf>,
    pending_keys: &mut HashSet<String>,
) -> Vec<PathBuf> {
    let batch_size = pending.len().min(MAX_BATCH_UPLOADS_PER_REQUEST);
    let mut paths = Vec::with_capacity(batch_size);
    for _ in 0..batch_size {
        if let Some(path) = pending.pop_front() {
            pending_keys.remove(&path.to_string_lossy().to_string());
            paths.push(path);
        }
    }
    paths
}

async fn flush_pending_batch(
    inner: &Arc<FolderWatcherInner>,
    session_generation: u64,
    pending: &mut VecDeque<PathBuf>,
    pending_keys: &mut HashSet<String>,
) {
    let paths = take_batch_snapshot(pending, pending_keys);
    if paths.is_empty() {
        return;
    }
    process_batch(inner.clone(), paths, session_generation).await;
}

async fn process_batch(
    inner: Arc<FolderWatcherInner>,
    paths: Vec<PathBuf>,
    session_generation: u64,
) {
    if !is_session_active(&inner, session_generation) {
        return;
    }

    let config = inner.settings.get_folder_watcher_config();
    let watch_path = match config.watch_path.as_ref() {
        Some(path) => PathBuf::from(path),
        None => return,
    };

    let uploaded_dir = uploaded_subdir(&watch_path);
    let custom_move = config.custom_move_path.as_ref().map(PathBuf::from);

    let mut accepted_paths = Vec::new();
    for file_path in paths {
        if should_ignore_watched_file(
            &file_path,
            &watch_path,
            Some(&uploaded_dir),
            custom_move.as_deref(),
        ) {
            continue;
        }

        let filename = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.torrent")
            .to_string();

        let _ = inner.app.emit(
            EVENT_TORRENT_DETECTED,
            serde_json::json!({
                "filename": filename,
                "path": file_path.to_string_lossy(),
            }),
        );
        adjust_queue_depth(&inner, 1);
        accepted_paths.push((file_path, filename));
    }

    if accepted_paths.is_empty() {
        return;
    }

    let stable_ms = config.stable_file_ms;
    let mut join_set = JoinSet::new();
    for (file_path, filename) in accepted_paths {
        join_set.spawn(async move {
            let result = wait_for_stable_file(&file_path, stable_ms).await;
            (file_path, filename, result)
        });
    }

    let mut ready_items = Vec::new();
    while let Some(joined) = join_set.join_next().await {
        match joined {
            Ok((file_path, filename, Ok(bytes))) => {
                if !is_session_active(&inner, session_generation) {
                    adjust_queue_depth(&inner, -1);
                    continue;
                }

                let fingerprint = sha256_hex(&bytes);
                if inner.processed.has_fingerprint(&fingerprint) || is_in_flight(&inner, &fingerprint)
                {
                    adjust_queue_depth(&inner, -1);
                    continue;
                }

                ready_items.push(ReadyTorrent {
                    path: file_path,
                    filename,
                    bytes,
                    fingerprint,
                });
            }
            Ok((_, filename, Err(error))) => {
                if is_session_active(&inner, session_generation) {
                    record_failure(&inner, &filename, &error, false);
                    let _ = inner.app.emit(
                        EVENT_UPLOAD_FAILED,
                        serde_json::json!({
                            "filename": filename,
                            "error": error,
                            "willRetry": false,
                        }),
                    );
                }
                adjust_queue_depth(&inner, -1);
            }
            Err(_) => {}
        }
    }

    if ready_items.is_empty() {
        return;
    }

    for item in &ready_items {
        set_in_flight(&inner, &item.fingerprint, true);
        let _ = inner.app.emit(
            EVENT_UPLOAD_QUEUED,
            serde_json::json!({
                "filename": item.filename,
                "fingerprint": item.fingerprint,
            }),
        );
    }

    let upload_items: Vec<TorrentFileUpload> = ready_items
        .iter()
        .map(|item| TorrentFileUpload {
            file_bytes: item.bytes.clone(),
            filename: item.filename.clone(),
            options: config.torrent_options.clone(),
        })
        .collect();

    let instance_url = inner.settings.get_instance_url();
    let api_key = match read_api_key(&inner.settings) {
        Ok(key) => key,
        Err(message) => {
            for item in &ready_items {
                set_in_flight(&inner, &item.fingerprint, false);
                adjust_queue_depth(&inner, -1);
                record_failure(&inner, &item.filename, &message, false);
            }
            return;
        }
    };
    let batch_results = match upload_batch_with_retries(
        &inner,
        &instance_url,
        &api_key,
        upload_items,
        session_generation,
        &ready_items,
    )
    .await
    {
        Some(results) => results,
        None => {
            for item in &ready_items {
                set_in_flight(&inner, &item.fingerprint, false);
                adjust_queue_depth(&inner, -1);
            }
            return;
        }
    };

    let mut success_count = 0u32;
    let mut failure_count = 0u32;
    let mut single_success_filename: Option<String> = None;
    let mut single_failure_filename: Option<String> = None;
    let mut first_error: Option<String> = None;

    for (item, result) in ready_items.into_iter().zip(batch_results.into_iter()) {
        apply_batch_item_result(
            &inner,
            &config,
            item,
            result,
            session_generation,
            &mut success_count,
            &mut failure_count,
            &mut single_success_filename,
            &mut single_failure_filename,
            &mut first_error,
        )
        .await;
    }

    notify_batch_upload_result(
        &inner.app,
        success_count,
        failure_count,
        single_success_filename
            .as_deref()
            .or(single_failure_filename.as_deref()),
        first_error.as_deref(),
    );
}

async fn upload_batch_with_retries(
    inner: &FolderWatcherInner,
    instance_url: &str,
    api_key: &str,
    upload_items: Vec<TorrentFileUpload>,
    session_generation: u64,
    ready_items: &[ReadyTorrent],
) -> Option<Vec<BatchItemResult>> {
    let mut attempt = 0u32;
    let mut rate_limit_attempts = 0u32;

    loop {
        if !is_session_active(inner, session_generation) {
            return None;
        }

        match upload_torrent_batch_detailed(instance_url, api_key, upload_items.clone()).await {
            Ok(results) => return Some(results),
            Err(error) => {
                let message = error.message.clone();
                if error.rate_limited && rate_limit_attempts < WATCHER_RATE_LIMIT_MAX_RETRIES {
                    rate_limit_attempts += 1;
                    for item in ready_items {
                        record_failure(
                            inner,
                            &item.filename,
                            &message,
                            true,
                        );
                    }
                    tokio::time::sleep(error.retry_delay()).await;
                    continue;
                }

                attempt += 1;
                if attempt < WATCHER_MAX_RETRIES {
                    let backoff_secs = 2u64.pow(attempt);
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                    continue;
                }

                for item in ready_items {
                    record_failure(inner, &item.filename, &message, false);
                    set_in_flight(inner, &item.fingerprint, false);
                    adjust_queue_depth(inner, -1);
                    let _ = inner.app.emit(
                        EVENT_UPLOAD_FAILED,
                        serde_json::json!({
                            "filename": item.filename,
                            "error": message,
                            "willRetry": false,
                        }),
                    );
                }
                return None;
            }
        }
    }
}

async fn apply_batch_item_result(
    inner: &FolderWatcherInner,
    config: &FolderWatcherConfig,
    item: ReadyTorrent,
    result: BatchItemResult,
    session_generation: u64,
    success_count: &mut u32,
    failure_count: &mut u32,
    single_success_filename: &mut Option<String>,
    single_failure_filename: &mut Option<String>,
    first_error: &mut Option<String>,
) {
    if !is_session_active(inner, session_generation) {
        set_in_flight(inner, &item.fingerprint, false);
        adjust_queue_depth(inner, -1);
        return;
    }

    if let Some(success) = result.success {
        if let Err(error) = inner.processed.mark_processed(&item.fingerprint, &item.filename) {
            record_failure(&inner, &item.filename, &error, false);
            set_in_flight(&inner, &item.fingerprint, false);
            adjust_queue_depth(inner, -1);
            *failure_count += 1;
            if single_failure_filename.is_none() {
                *single_failure_filename = Some(item.filename.clone());
            }
            if first_error.is_none() {
                *first_error = Some(error.clone());
            }
            let _ = inner.app.emit(
                EVENT_UPLOAD_FAILED,
                serde_json::json!({
                    "filename": item.filename,
                    "error": error,
                    "willRetry": false,
                }),
            );
            return;
        }

        match apply_post_upload_action(&item.path, config) {
            Ok(moved_to) => {
                record_success(&inner, &item.filename, moved_to.clone());
                let _ = inner.app.emit(
                    EVENT_UPLOAD_SUCCEEDED,
                    serde_json::json!({
                        "filename": item.filename,
                        "uploadId": success.upload_id,
                        "movedTo": moved_to,
                    }),
                );
            }
            Err(error) => {
                record_move_failed(&inner, &item.filename, &error);
                let _ = inner.app.emit(
                    EVENT_UPLOAD_SUCCEEDED,
                    serde_json::json!({
                        "filename": item.filename,
                        "uploadId": success.upload_id,
                        "movedTo": null,
                        "postActionWarning": error,
                    }),
                );
            }
        }

        *success_count += 1;
        if *success_count == 1 && *failure_count == 0 {
            *single_success_filename = Some(item.filename);
        } else {
            *single_success_filename = None;
        }
    } else {
        let error = result
            .error
            .unwrap_or_else(|| "Upload failed".to_string());
        if first_error.is_none() {
            *first_error = Some(error.clone());
        }
        record_failure(&inner, &item.filename, &error, false);
        if first_error.is_none() {
            *first_error = Some(error.clone());
        }
        let _ = inner.app.emit(
            EVENT_UPLOAD_FAILED,
            serde_json::json!({
                "filename": item.filename,
                "error": error,
                "willRetry": false,
            }),
        );
        *failure_count += 1;
        if *failure_count == 1 && *success_count == 0 {
            *single_failure_filename = Some(item.filename);
        } else {
            *single_failure_filename = None;
        }
    }

    set_in_flight(inner, &item.fingerprint, false);
    adjust_queue_depth(inner, -1);
}

fn notify_batch_upload_result(
    app: &AppHandle,
    success_count: u32,
    failure_count: u32,
    single_filename: Option<&str>,
    first_error: Option<&str>,
) {
    if let Some(state) = app.try_state::<AppState>() {
        state.notifications.show_batch_upload_notification(
            app,
            success_count,
            failure_count,
            single_filename,
            first_error,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enqueue_dedupes_paths() {
        let mut pending = VecDeque::new();
        let mut keys = HashSet::new();
        let path = PathBuf::from("/tmp/example.torrent");

        enqueue_pending_path(&mut pending, &mut keys, path.clone());
        enqueue_pending_path(&mut pending, &mut keys, path);

        assert_eq!(pending.len(), 1);
    }

    #[test]
    fn take_batch_snapshot_caps_at_max_request_size() {
        let mut pending = VecDeque::new();
        let mut keys = HashSet::new();
        for index in 0..1005 {
            let path = PathBuf::from(format!("/tmp/file-{index}.torrent"));
            enqueue_pending_path(&mut pending, &mut keys, path);
        }

        let first = take_batch_snapshot(&mut pending, &mut keys);
        assert_eq!(first.len(), MAX_BATCH_UPLOADS_PER_REQUEST);
        assert_eq!(pending.len(), 5);
    }

    #[test]
    fn next_coalesce_delay_uses_drain_when_backlog_exceeds_batch() {
        assert_eq!(
            next_coalesce_delay(MAX_BATCH_UPLOADS_PER_REQUEST),
            Duration::from_millis(WATCHER_BATCH_COALESCE_MS)
        );
        assert_eq!(
            next_coalesce_delay(MAX_BATCH_UPLOADS_PER_REQUEST + 1),
            Duration::from_millis(WATCHER_BATCH_DRAIN_MS)
        );
    }
}
