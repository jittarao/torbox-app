use serde::Serialize;
use tauri::{AppHandle, State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::services::capabilities::emit_capabilities_changed;
use crate::services::settings::TraySettings;
use crate::services::tray::{hide_main_window, show_main_window};
use crate::state::AppState;

#[tauri::command]
pub fn get_tray_settings(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<TraySettings, String> {
    validate_window_origin(&window, &state)?;
    Ok(state.settings.get_tray_settings())
}

#[tauri::command]
pub fn set_tray_settings(
    tray: TraySettings,
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TraySettings, String> {
    validate_window_origin(&window, &state)?;
    state.settings.set_tray_settings(tray.clone())?;
    emit_capabilities_changed(&app);
    Ok(tray)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayActionResult {
    pub visible: bool,
}

#[tauri::command]
pub fn show_main_window_command(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<TrayActionResult, String> {
    validate_window_origin(&window, &state)?;
    show_main_window(&app, false);
    Ok(TrayActionResult { visible: true })
}

#[tauri::command]
pub fn hide_main_window_command(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<TrayActionResult, String> {
    validate_window_origin(&window, &state)?;
    hide_main_window(&app);
    Ok(TrayActionResult { visible: false })
}
