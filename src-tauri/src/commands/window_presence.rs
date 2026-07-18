use tauri::{AppHandle, Manager};

use crate::services::window_presence;

#[tauri::command]
pub fn get_window_engaged(app: AppHandle) -> Result<bool, String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(true);
    };

    Ok(window_presence::is_window_engaged(&window))
}
