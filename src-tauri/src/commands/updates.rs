use tauri::{AppHandle, State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::services::updates::{check_for_update, install_update, is_updater_active, UpdateInfo};
use crate::state::AppState;

#[tauri::command]
pub async fn check_for_update_command(
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<UpdateInfo>, String> {
    validate_window_origin(&window, &state)?;
    if !is_updater_active() {
        return Ok(None);
    }
    check_for_update(&app).await
}

#[tauri::command]
pub async fn install_update_command(
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    install_update(&app).await
}
