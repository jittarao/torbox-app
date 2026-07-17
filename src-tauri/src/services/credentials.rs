use chrono::Utc;
use keyring::Entry;

use crate::constants::{KEYRING_SERVICE, KEYRING_USER};
use crate::services::settings::SettingsService;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialStatus {
    pub has_api_key: bool,
    pub last_updated_at: Option<String>,
}

pub fn read_credential_status(settings: &SettingsService) -> CredentialStatus {
    let has_api_key = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .map(|value| !value.is_empty())
        .unwrap_or(false);

    CredentialStatus {
        has_api_key,
        last_updated_at: settings.get_credential_last_updated_at(),
    }
}

pub fn sync_api_key(key: &str, settings: &SettingsService) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".into());
    }

    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Credential store unavailable: {e}"))?;
    entry
        .set_password(trimmed)
        .map_err(|e| format!("Failed to store API key: {e}"))?;

    let timestamp = Utc::now().to_rfc3339();
    settings.set_credential_last_updated_at(Some(timestamp))?;
    Ok(())
}

pub fn clear_api_key(settings: &SettingsService) -> Result<(), String> {
    if let Ok(entry) = Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        let _ = entry.delete_credential();
    }
    settings.set_credential_last_updated_at(None)?;
    Ok(())
}
