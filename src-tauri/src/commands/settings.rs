use tauri::{AppHandle, State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::state::AppState;

#[tauri::command]
pub fn get_instance_url(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<String, String> {
    validate_window_origin(&window, &state)?;
    Ok(state.settings.get_instance_url())
}

#[tauri::command]
pub fn set_instance_url(
    url: String,
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<String, String> {
    validate_window_origin(&window, &state)?;
    let normalized = state.settings.set_instance_url(url)?;
    crate::services::capabilities::register_custom_instance_capability(&app, &normalized)?;
    Ok(normalized)
}
