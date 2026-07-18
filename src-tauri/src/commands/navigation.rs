use tauri::{State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::state::AppState;

#[tauri::command]
pub fn set_last_web_path(
    path: String,
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    state.settings.set_last_web_path(Some(path))
}
