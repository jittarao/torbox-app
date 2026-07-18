use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

pub const EVENT_UPDATE_AVAILABLE: &str = "desktop://update-available";
pub const EVENT_UPDATE_PROGRESS: &str = "desktop://update-progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
}

pub fn is_updater_active() -> bool {
    std::env::var("TAURI_UPDATER_ACTIVE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(cfg!(debug_assertions))
}

pub async fn check_for_update(app: &AppHandle) -> Result<Option<UpdateInfo>, String> {
    if !is_updater_active() {
        return Ok(None);
    }

    let updater = app
        .updater()
        .map_err(|e| format!("Updater is not configured: {e}"))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {e}"))?;

    let Some(update) = update else {
        return Ok(None);
    };

    let info = UpdateInfo {
        version: update.version.clone(),
        current_version: app.package_info().version.to_string(),
        notes: update.body.clone(),
    };

    let _ = app.emit(EVENT_UPDATE_AVAILABLE, &info);
    Ok(Some(info))
}

pub async fn install_update(app: &AppHandle) -> Result<(), String> {
    if !is_updater_active() {
        return Err("Desktop updates are not enabled in this build".into());
    }

    let updater = app
        .updater()
        .map_err(|e| format!("Updater is not configured: {e}"))?;

    let Some(update) = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {e}"))?
    else {
        return Err("No update is available".into());
    };

    let app_handle = app.clone();
    let mut downloaded_bytes = 0u64;
    update
        .download_and_install(
            |chunk_length, content_length| {
                downloaded_bytes += chunk_length as u64;
                let _ = app_handle.emit(
                    EVENT_UPDATE_PROGRESS,
                    UpdateProgress {
                        downloaded: downloaded_bytes,
                        total: content_length,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| format!("Failed to install update: {e}"))?;

    app.restart();
}
