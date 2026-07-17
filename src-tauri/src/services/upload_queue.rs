use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use chrono::{Duration as ChronoDuration, Utc};
use serde::{Deserialize, Serialize};

use crate::constants::WATCHER_PROCESSED_RETENTION_DAYS;
use crate::constants::MAX_TORRENT_FILE_BYTES;
use crate::services::atomic_json::write_atomic;
use crate::services::settings::{FolderWatcherConfig, PostUploadAction};
use crate::services::watcher_paths::{unique_destination_path, uploaded_subdir};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProcessedEntry {
    processed_at: String,
    filename: String,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct ProcessedStore {
    #[serde(default)]
    entries: HashMap<String, ProcessedEntry>,
}

pub struct ProcessedFingerprintStore {
    path: PathBuf,
    store: Mutex<ProcessedStore>,
}

impl ProcessedFingerprintStore {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
        let path = app_data_dir.join("watcher-processed.json");
        let store = if path.exists() {
            let raw = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read processed store: {e}"))?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            ProcessedStore::default()
        };

        let service = Self {
            path,
            store: Mutex::new(store),
        };
        service.prune_old_entries()?;
        Ok(service)
    }

    pub fn has_fingerprint(&self, fingerprint: &str) -> bool {
        self.store
            .lock()
            .ok()
            .map(|store| store.entries.contains_key(fingerprint))
            .unwrap_or(false)
    }

    pub fn mark_processed(&self, fingerprint: &str, filename: &str) -> Result<(), String> {
        let mut store = self
            .store
            .lock()
            .map_err(|_| "Processed store lock poisoned".to_string())?;
        store.entries.insert(
            fingerprint.to_string(),
            ProcessedEntry {
                processed_at: Utc::now().to_rfc3339(),
                filename: filename.to_string(),
            },
        );
        self.persist(&store)
    }

    fn prune_old_entries(&self) -> Result<(), String> {
        let cutoff = Utc::now() - ChronoDuration::days(WATCHER_PROCESSED_RETENTION_DAYS);
        let mut store = self
            .store
            .lock()
            .map_err(|_| "Processed store lock poisoned".to_string())?;
        store.entries.retain(|_, entry| {
            chrono::DateTime::parse_from_rfc3339(&entry.processed_at)
                .map(|dt| dt.with_timezone(&Utc) > cutoff)
                .unwrap_or(false)
        });
        self.persist(&store)
    }

    fn persist(&self, store: &ProcessedStore) -> Result<(), String> {
        let raw = serde_json::to_string_pretty(store)
            .map_err(|e| format!("Failed to encode processed store: {e}"))?;
        write_atomic(&self.path, &raw)
    }
}

pub fn apply_post_upload_action(
    source_path: &Path,
    config: &FolderWatcherConfig,
) -> Result<Option<String>, String> {
    match config.post_upload_action {
        PostUploadAction::Delete => {
            fs::remove_file(source_path)
                .map_err(|e| format!("Failed to delete torrent file: {e}"))?;
            Ok(None)
        }
        PostUploadAction::MoveToUploaded => {
            let watch_root = config
                .watch_path
                .as_ref()
                .ok_or("Watch path is not configured")?;
            let dest_dir = uploaded_subdir(Path::new(watch_root));
            fs::create_dir_all(&dest_dir)
                .map_err(|e| format!("Failed to create uploaded directory: {e}"))?;
            let filename = source_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("Invalid torrent filename")?;
            let dest = unique_destination_path(&dest_dir, filename);
            fs::rename(source_path, &dest)
                .map_err(|e| format!("Failed to move torrent file: {e}"))?;
            Ok(Some(dest.to_string_lossy().to_string()))
        }
        PostUploadAction::MoveToCustom => {
            let dest_dir = config
                .custom_move_path
                .as_ref()
                .ok_or("Custom move path is not configured")?;
            let dest_root = Path::new(dest_dir);
            fs::create_dir_all(dest_root)
                .map_err(|e| format!("Failed to create custom move directory: {e}"))?;
            let filename = source_path
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or("Invalid torrent filename")?;
            let dest = unique_destination_path(dest_root, filename);
            fs::rename(source_path, &dest)
                .map_err(|e| format!("Failed to move torrent file: {e}"))?;
            Ok(Some(dest.to_string_lossy().to_string()))
        }
    }
}

pub async fn wait_for_stable_file(path: &Path, stable_ms: u64) -> Result<Vec<u8>, String> {
    let poll_interval = Duration::from_millis(500);
    let stable_duration = Duration::from_millis(stable_ms.max(500));
    let max_wait = Duration::from_secs(120);
    let started = SystemTime::now();

    let mut last_size: Option<u64> = None;
    let mut stable_since = SystemTime::now();

    loop {
        if started.elapsed().unwrap_or(Duration::ZERO) > max_wait {
            return Err("Timed out waiting for torrent file to stabilize".into());
        }

        let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {e}"))?;
        let size = metadata.len();

        if size > MAX_TORRENT_FILE_BYTES {
            return Err(format!(
                "Torrent file exceeds maximum size of {} bytes",
                MAX_TORRENT_FILE_BYTES
            ));
        }

        if Some(size) == last_size {
            if stable_since.elapsed().unwrap_or(Duration::ZERO) >= stable_duration {
                return fs::read(path).map_err(|e| format!("Failed to read torrent file: {e}"));
            }
        } else {
            last_size = Some(size);
            stable_since = SystemTime::now();
        }

        tokio::time::sleep(poll_interval).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn move_to_uploaded_subdir() {
        let watch = temp_dir("tbm-post");
        let source = watch.join("a.torrent");
        fs::write(&source, b"torrent").unwrap();
        let config = FolderWatcherConfig {
            watch_path: Some(watch.to_string_lossy().to_string()),
            post_upload_action: PostUploadAction::MoveToUploaded,
            ..Default::default()
        };

        let moved_to = apply_post_upload_action(&source, &config).unwrap();
        assert!(moved_to.is_some());
        assert!(!source.exists());
        assert!(watch.join("uploaded").join("a.torrent").exists());
    }

    #[test]
    fn processed_store_persists_atomically() {
        let dir = temp_dir("tbm-processed");
        let store = ProcessedFingerprintStore::new(&dir).unwrap();
        store.mark_processed("abc123", "test.torrent").unwrap();
        let reloaded = ProcessedFingerprintStore::new(&dir).unwrap();
        assert!(reloaded.has_fingerprint("abc123"));
    }
}
