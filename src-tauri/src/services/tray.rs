use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewWindow,
};

use crate::constants::APP_DISPLAY_NAME;
use crate::services::settings::SettingsService;
use crate::services::window_state;
use crate::state::AppState;

const TRAY_OPEN_ID: &str = "tray-open";
const TRAY_SETTINGS_ID: &str = "tray-settings";
const TRAY_QUIT_ID: &str = "tray-quit";
pub const EVENT_TRAY_OPEN_SETTINGS: &str = "desktop://tray-open-settings";

pub fn setup_tray(app: &AppHandle) -> Result<(), String> {
    let open_item = MenuItem::with_id(app, TRAY_OPEN_ID, "Open TorBox Manager", true, None::<&str>)
        .map_err(|e| format!("Failed to create tray menu item: {e}"))?;
    let settings_item =
        MenuItem::with_id(app, TRAY_SETTINGS_ID, "Settings", true, None::<&str>)
            .map_err(|e| format!("Failed to create tray menu item: {e}"))?;
    let quit_item = MenuItem::with_id(app, TRAY_QUIT_ID, "Quit", true, None::<&str>)
        .map_err(|e| format!("Failed to create tray menu item: {e}"))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create tray separator: {e}"))?;

    let menu = Menu::with_items(
        app,
        &[&open_item, &settings_item, &separator, &quit_item],
    )
    .map_err(|e| format!("Failed to build tray menu: {e}"))?;

    let icon = app
        .default_window_icon()
        .ok_or("Missing default window icon for tray")?
        .clone();

    let app_handle = app.clone();
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip(APP_DISPLAY_NAME)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            TRAY_OPEN_ID => {
                show_main_window(app, false);
            }
            TRAY_SETTINGS_ID => {
                show_main_window(app, true);
            }
            TRAY_QUIT_ID => {
                quit_app(app);
            }
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                toggle_main_window(app);
            }
        })
        .build(&app_handle)
        .map_err(|e| format!("Failed to create tray icon: {e}"))?;

    Ok(())
}

static WINDOW_BEHAVIOR_REGISTERED: AtomicBool = AtomicBool::new(false);

/// Registers close/minimize-to-tray handlers once at startup. Reads current tray
/// settings from `SettingsService` on each event so toggles apply without re-registering.
pub fn register_window_behavior(
    app: &AppHandle,
    settings: &Arc<SettingsService>,
) -> Result<(), String> {
    if WINDOW_BEHAVIOR_REGISTERED.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    let app_handle = app.clone();
    let settings = Arc::clone(settings);
    window.on_window_event(move |event| {
        let tray_settings = settings.get_tray_settings();
        window_state::handle_window_geometry_event(&app_handle, &settings, event);
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if tray_settings.close_to_tray {
                    api.prevent_close();
                    hide_main_window(&app_handle);
                }
            }
            tauri::WindowEvent::Resized(_) => {
                if tray_settings.minimize_to_tray {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if window.is_minimized().unwrap_or(false) {
                            let _ = window.hide();
                        }
                    }
                }
            }
            _ => {}
        }
    });

    Ok(())
}

/// Hides the main window on launch when launch-at-login + start-hidden are enabled.
pub fn apply_start_hidden_if_needed(app: &AppHandle, settings: &SettingsService) {
    if settings.should_start_hidden() {
        hide_main_window(app);
    }
}

pub fn show_main_window(app: &AppHandle, open_settings: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }

    if open_settings {
        let _ = app.emit(EVENT_TRAY_OPEN_SETTINGS, ());
    }
}

pub fn hide_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let visible = window.is_visible().unwrap_or(true);
        if visible {
            hide_main_window(app);
        } else {
            show_main_window(app, false);
        }
    }
}

pub fn quit_app(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        window_state::persist_main_window_geometry(app, state.settings.as_ref());
        state.folder_watcher.shutdown();
    }
    app.exit(0);
}

pub fn handle_run_event(app: &AppHandle, event: &RunEvent) {
    if let RunEvent::ExitRequested { api, .. } = event {
        if let Some(state) = app.try_state::<AppState>() {
            if state.settings.get_tray_settings().close_to_tray {
                window_state::persist_main_window_geometry(app, state.settings.as_ref());
                api.prevent_exit();
                hide_main_window(app);
            }
        }
    }
}

#[allow(dead_code)]
pub fn focus_main_window(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}
