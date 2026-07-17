use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::constants::DEFAULT_INSTANCE_URL;
use crate::services::url_validation::{default_instance_url, validate_instance_url};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSettings {
    #[serde(default = "default_instance_url")]
    pub instance_url: String,
    #[serde(default)]
    pub credential_last_updated_at: Option<String>,
}

impl Default for DesktopSettings {
    fn default() -> Self {
        Self {
            instance_url: default_instance_url(),
            credential_last_updated_at: None,
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
            let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            DesktopSettings::default()
        };
        Ok(Self {
            path,
            settings: Mutex::new(settings),
        })
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

    fn persist(&self, settings: &DesktopSettings) -> Result<(), String> {
        let raw =
            serde_json::to_string_pretty(settings).map_err(|e| format!("Failed to encode settings: {e}"))?;
        fs::write(&self.path, raw).map_err(|e| format!("Failed to write settings: {e}"))
    }
}
