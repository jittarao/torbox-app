use rfd::FileDialog;
use tauri::{State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::state::AppState;

#[tauri::command]
pub async fn pick_folder(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    validate_window_origin(&window, &state)?;
    let picked = tauri::async_runtime::spawn_blocking(|| FileDialog::new().pick_folder())
        .await
        .map_err(|e| format!("Folder picker task failed: {e}"))?;
    match picked {
        Some(path) => {
            let normalized = state
                .settings
                .register_watch_path_from_picker(&path.to_string_lossy())?;
            Ok(Some(normalized))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn pick_move_destination_folder(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    validate_window_origin(&window, &state)?;
    let picked = tauri::async_runtime::spawn_blocking(|| FileDialog::new().pick_folder())
        .await
        .map_err(|e| format!("Folder picker task failed: {e}"))?;
    match picked {
        Some(path) => {
            let normalized = state
                .settings
                .register_move_path_from_picker(&path.to_string_lossy())?;
            Ok(Some(normalized))
        }
        None => Ok(None),
    }
}
