use chrono::Utc;

use crate::services::settings::SettingsService;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    pub has_api_key: bool,
    pub last_updated_at: Option<String>,
}

fn read_stored_api_key(settings: &SettingsService) -> Result<String, String> {
    let key = settings
        .get_stored_api_key()
        .ok_or_else(|| "No API key stored on this device".to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("No API key stored on this device".into());
    }
    Ok(trimmed)
}

fn has_stored_api_key(settings: &SettingsService) -> bool {
    read_stored_api_key(settings).is_ok()
}

pub fn read_credential_status(settings: &SettingsService) -> CredentialStatus {
    let has_api_key = has_stored_api_key(settings);

    let last_updated_at = if has_api_key {
        settings.get_credential_last_updated_at()
    } else if settings.get_credential_last_updated_at().is_some() {
        let _ = settings.clear_stored_api_key();
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

    let timestamp = Utc::now().to_rfc3339();
    settings.set_stored_api_key(Some(trimmed.to_string()), Some(timestamp))?;

    let stored = read_stored_api_key(settings)?;
    if stored != trimmed {
        let _ = settings.clear_stored_api_key();
        return Err("Stored API key could not be verified after save".into());
    }

    Ok(())
}

pub fn clear_api_key(settings: &SettingsService) -> Result<(), String> {
    settings.clear_stored_api_key()
}

pub fn read_api_key(settings: &SettingsService) -> Result<String, String> {
    read_stored_api_key(settings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
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

    #[test]
    fn stored_api_key_persists_in_desktop_settings_json() {
        let (service, dir) = temp_settings_service();

        sync_api_key("settings-json-key", &service).unwrap();

        let settings_path = dir.join("desktop-settings.json");
        assert!(settings_path.exists());
        let raw = fs::read_to_string(&settings_path).unwrap();
        assert!(raw.contains("settings-json-key"));

        let _ = fs::remove_dir_all(dir);
    }
}
