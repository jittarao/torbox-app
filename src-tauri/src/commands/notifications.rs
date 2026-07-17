use tauri::{AppHandle, State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::services::capabilities::emit_capabilities_changed;
use crate::services::notifications::notification_permission_hint;
use crate::services::settings::NotificationSettings;
use crate::state::AppState;

#[tauri::command]
pub fn get_notification_settings(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<NotificationSettings, String> {
    validate_window_origin(&window, &state)?;
    Ok(state.notifications.get_settings())
}

#[tauri::command]
pub fn set_notification_settings(
    settings: NotificationSettings,
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<NotificationSettings, String> {
    validate_window_origin(&window, &state)?;
    state.notifications.set_settings(settings.clone())?;
    emit_capabilities_changed(&app);
    Ok(settings)
}

#[tauri::command]
pub fn show_test_notification(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    state
        .notifications
        .show_test_notification(&app)
        .map_err(|error| format!("{error} {hint}", hint = notification_permission_hint()))
}
