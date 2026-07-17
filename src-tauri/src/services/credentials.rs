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

fn credential_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Credential store unavailable: {e}"))
}

pub fn read_credential_status(settings: &SettingsService) -> CredentialStatus {
    let has_api_key = credential_entry()
        .and_then(|entry| {
            entry
                .get_password()
                .map(|value| !value.trim().is_empty())
                .map_err(|e| format!("Failed to read stored API key: {e}"))
        })
        .unwrap_or(false);

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

    let entry = credential_entry()?;
    entry
        .set_password(trimmed)
        .map_err(|e| format!("Failed to store API key: {e}"))?;

    let stored = entry
        .get_password()
        .map_err(|e| format!("Stored API key could not be read back: {e}"))?;
    if stored.trim() != trimmed {
        let _ = entry.delete_credential();
        return Err("Stored API key could not be verified after save".into());
    }

    let timestamp = Utc::now().to_rfc3339();
    settings.set_credential_last_updated_at(Some(timestamp))?;
    Ok(())
}

pub fn clear_api_key(settings: &SettingsService) -> Result<(), String> {
    if let Ok(entry) = credential_entry() {
        let _ = entry.delete_credential();
    }
    settings.set_credential_last_updated_at(None)?;
    Ok(())
}

pub fn read_api_key() -> Result<String, String> {
    let key = credential_entry()?
        .get_password()
        .map_err(|_| "No API key stored on this device".to_string())?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        return Err("No API key stored on this device".into());
    }
    Ok(trimmed)
}
