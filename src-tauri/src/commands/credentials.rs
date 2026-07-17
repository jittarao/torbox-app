use tauri::{State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::services::credentials::{
    clear_api_key, read_credential_status, sync_api_key, CredentialStatus,
};
use crate::state::AppState;

#[tauri::command]
pub fn sync_api_key_to_desktop(
    key: String,
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    sync_api_key(&key, &state.settings)
}

#[tauri::command]
pub fn get_credential_status(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<CredentialStatus, String> {
    validate_window_origin(&window, &state)?;
    Ok(read_credential_status(&state.settings))
}

#[tauri::command]
pub fn clear_desktop_credential(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    let _ = state.folder_watcher.stop();
    clear_api_key(&state.settings)
}
