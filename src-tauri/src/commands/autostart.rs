use serde::Serialize;
use tauri::{AppHandle, State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::constants::APP_DISPLAY_NAME;
use crate::state::AppState;

#[cfg(not(target_os = "macos"))]
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchAtLoginStatus {
    pub enabled: bool,
    pub os_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_approval: Option<bool>,
}

fn is_os_launch_at_login_enabled(app: &AppHandle) -> bool {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        return crate::services::macos_autostart::is_enabled().unwrap_or(false);
    }

    #[cfg(not(target_os = "macos"))]
    {
        app.autolaunch().is_enabled().unwrap_or(false)
    }
}

fn launch_at_login_status(app: &AppHandle, pref: bool) -> LaunchAtLoginStatus {
    let os_enabled = is_os_launch_at_login_enabled(app);
    #[cfg(target_os = "macos")]
    let requires_approval = if pref && os_enabled {
        Some(crate::services::macos_autostart::requires_approval())
    } else {
        None
    };
    #[cfg(not(target_os = "macos"))]
    let requires_approval = None;

    LaunchAtLoginStatus {
        enabled: pref,
        os_enabled,
        requires_approval,
    }
}

fn set_os_launch_at_login(app: &AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;
        if enabled {
            crate::services::macos_autostart::enable()
        } else {
            crate::services::macos_autostart::disable()
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        let manager = app.autolaunch();
        if enabled {
            manager
                .enable()
                .map_err(|e| format!("Failed to enable launch at login: {e}"))
        } else {
            manager
                .disable()
                .map_err(|e| format!("Failed to disable launch at login: {e}"))
        }
    }
}

pub fn sync_launch_at_login(app: &AppHandle, settings: &crate::services::settings::SettingsService) {
    let desired = settings.get_launch_at_login();

    #[cfg(target_os = "macos")]
    if desired {
        let _ = crate::services::macos_autostart::migrate_if_needed();
    }

    let os_enabled = is_os_launch_at_login_enabled(app);

    if desired && !os_enabled {
        let _ = set_os_launch_at_login(app, true);
    } else if !desired && os_enabled {
        let _ = set_os_launch_at_login(app, false);
    }
}

#[tauri::command]
pub fn get_launch_at_login(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<LaunchAtLoginStatus, String> {
    validate_window_origin(&window, &state)?;
    let pref = state.settings.get_launch_at_login();
    Ok(launch_at_login_status(&app, pref))
}

#[tauri::command]
pub async fn set_launch_at_login(
    enabled: bool,
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<LaunchAtLoginStatus, String> {
    validate_window_origin(&window, &state)?;

    set_os_launch_at_login(&app, enabled)?;

    let os_enabled = is_os_launch_at_login_enabled(&app);
    if enabled && !os_enabled {
        return Err(format!(
            "Launch at login could not be enabled in system settings. Try again or enable {APP_DISPLAY_NAME} manually in Login Items."
        ));
    }

    let persisted = if enabled { os_enabled } else { false };
    state.settings.set_launch_at_login(persisted)?;

    Ok(launch_at_login_status(&app, persisted))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_status_prefers_stored_enabled_flag() {
        let status = LaunchAtLoginStatus {
            enabled: true,
            os_enabled: false,
            requires_approval: None,
        };
        assert!(status.enabled);
        assert!(!status.os_enabled);
    }
}
