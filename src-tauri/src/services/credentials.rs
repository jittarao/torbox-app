use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;

#[cfg(not(debug_assertions))]
use keyring::Entry;

#[cfg(not(debug_assertions))]
use crate::constants::{KEYRING_SERVICE, KEYRING_USER};
use crate::services::atomic_json::write_atomic;
use crate::services::settings::SettingsService;

#[cfg(debug_assertions)]
const DEV_API_KEY_FILENAME: &str = "dev-api-key";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    pub has_api_key: bool,
    pub last_updated_at: Option<String>,
}

#[cfg(not(debug_assertions))]
fn credential_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Credential store unavailable: {e}"))
}

#[cfg(debug_assertions)]
fn dev_api_key_path(settings: &SettingsService) -> PathBuf {
    settings.app_data_dir().join(DEV_API_KEY_FILENAME)
}

#[cfg(debug_assertions)]
fn restrict_file_permissions(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("Failed to read credential file permissions: {e}"))?
            .permissions();
        perms.set_mode(0o600);
        fs::set_permissions(path, perms)
            .map_err(|e| format!("Failed to restrict credential file permissions: {e}"))?;
    }
    Ok(())
}

#[cfg(debug_assertions)]
fn read_stored_api_key(settings: &SettingsService) -> Result<String, String> {
    let path = dev_api_key_path(settings);
    if !path.exists() {
        return Err("No API key stored on this device".into());
    }

    let key = fs::read_to_string(&path)
        .map_err(|_| "No API key stored on this device".to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("No API key stored on this device".into());
    }
    Ok(trimmed)
}

#[cfg(debug_assertions)]
fn write_stored_api_key(settings: &SettingsService, key: &str) -> Result<(), String> {
    let path = dev_api_key_path(settings);
    write_atomic(&path, key)?;
    restrict_file_permissions(&path)
}

#[cfg(debug_assertions)]
fn delete_stored_api_key(settings: &SettingsService) {
    let path = dev_api_key_path(settings);
    let _ = fs::remove_file(path);
}

#[cfg(debug_assertions)]
fn has_stored_api_key(settings: &SettingsService) -> bool {
    read_stored_api_key(settings).is_ok()
}

#[cfg(not(debug_assertions))]
fn read_stored_api_key(_settings: &SettingsService) -> Result<String, String> {
    let key = credential_entry()?
        .get_password()
        .map_err(|_| "No API key stored on this device".to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("No API key stored on this device".into());
    }
    Ok(trimmed)
}

#[cfg(not(debug_assertions))]
fn write_stored_api_key(_settings: &SettingsService, key: &str) -> Result<(), String> {
    let entry = credential_entry()?;
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to store API key: {e}"))?;

    let stored = entry
        .get_password()
        .map_err(|e| format!("Stored API key could not be read back: {e}"))?;
    if stored.trim() != key {
        let _ = entry.delete_credential();
        return Err("Stored API key could not be verified after save".into());
    }
    Ok(())
}

#[cfg(not(debug_assertions))]
fn delete_stored_api_key(_settings: &SettingsService) {
    if let Ok(entry) = credential_entry() {
        let _ = entry.delete_credential();
    }
}

#[cfg(not(debug_assertions))]
fn has_stored_api_key(_settings: &SettingsService) -> bool {
    read_stored_api_key(_settings).is_ok()
}

pub fn read_credential_status(settings: &SettingsService) -> CredentialStatus {
    let has_api_key = has_stored_api_key(settings);

    let last_updated_at = if has_api_key {
        settings.get_credential_last_updated_at()
    } else if settings.get_credential_last_updated_at().is_some() {
        let _ = settings.set_credential_last_updated_at(None);
        None
    } else {
        None
    };

    CredentialStatus {
        has_api_key,
        last_updated_at,
    }
}

pub fn sync_api_key(key: &str, settings: &SettingsService) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".into());
    }

    write_stored_api_key(settings, trimmed)?;

    let stored = read_stored_api_key(settings)?;
    if stored != trimmed {
        delete_stored_api_key(settings);
        return Err("Stored API key could not be verified after save".into());
    }

    let timestamp = Utc::now().to_rfc3339();
    settings.set_credential_last_updated_at(Some(timestamp))?;
    Ok(())
}

pub fn clear_api_key(settings: &SettingsService) -> Result<(), String> {
    delete_stored_api_key(settings);
    settings.set_credential_last_updated_at(None)?;
    Ok(())
}

pub fn read_api_key(settings: &SettingsService) -> Result<String, String> {
    read_stored_api_key(settings)
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
        let dir = std::env::temp_dir().join(format!("tbm-credentials-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        let service = SettingsService::new_for_test(&dir);
        (service, dir)
    }

    #[test]
    fn sync_read_and_clear_api_key_round_trip() {
        let (service, dir) = temp_settings_service();

        sync_api_key("test-api-key", &service).unwrap();
        assert!(read_credential_status(&service).has_api_key);
        assert_eq!(read_api_key(&service).unwrap(), "test-api-key");

        clear_api_key(&service).unwrap();
        assert!(!read_credential_status(&service).has_api_key);
        assert!(read_api_key(&service).is_err());

        let _ = fs::remove_dir_all(dir);
    }

    #[cfg(debug_assertions)]
    #[test]
    fn debug_store_uses_restricted_file_in_app_data_dir() {
        let (service, dir) = temp_settings_service();

        sync_api_key("file-backed-key", &service).unwrap();

        let path = dev_api_key_path(&service);
        assert_eq!(path, dir.join(DEV_API_KEY_FILENAME));
        assert!(path.exists());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }

        let _ = fs::remove_dir_all(dir);
    }
}
