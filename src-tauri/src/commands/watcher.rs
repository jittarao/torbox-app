use tauri::{State, WebviewWindow};

use crate::commands::hello::validate_window_origin;
use crate::services::folder_watcher::WatcherStatus;
use crate::services::settings::FolderWatcherConfig;
use crate::state::AppState;

fn rollback_watcher_enabled_on_start_failure(state: &AppState) {
    let _ = state.settings.disable_folder_watcher();
    let _ = state.folder_watcher.stop();
}

#[tauri::command]
pub fn get_folder_watcher_config(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<FolderWatcherConfig, String> {
    validate_window_origin(&window, &state)?;
    Ok(state.settings.get_folder_watcher_config())
}

#[tauri::command]
pub fn set_folder_watcher_config(
    config: FolderWatcherConfig,
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    state.settings.set_folder_watcher_config(config)?;

    let saved = state.settings.get_folder_watcher_config();
    if saved.enabled {
        state.folder_watcher.stop()?;
        if let Err(error) = state.folder_watcher.start(saved.scan_existing_on_enable) {
            rollback_watcher_enabled_on_start_failure(&state);
            return Err(error);
        }
    } else {
        state.folder_watcher.stop()?;
    }

    Ok(())
}

#[tauri::command]
pub fn start_folder_watcher(
    scan_existing: bool,
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    let was_enabled = state.settings.get_folder_watcher_config().enabled;
    match state.folder_watcher.start(scan_existing) {
        Ok(()) => Ok(()),
        Err(error) => {
            if was_enabled {
                rollback_watcher_enabled_on_start_failure(&state);
            }
            Err(error)
        }
    }
}

#[tauri::command]
pub fn stop_folder_watcher(window: WebviewWindow, state: State<AppState>) -> Result<(), String> {
    validate_window_origin(&window, &state)?;
    state.folder_watcher.stop()
}

#[tauri::command]
pub fn get_folder_watcher_status(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<WatcherStatus, String> {
    validate_window_origin(&window, &state)?;
    Ok(state.folder_watcher.get_status())
}
