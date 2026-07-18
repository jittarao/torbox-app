use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewWindow,
};

#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;

use crate::constants::APP_DISPLAY_NAME;
use crate::services::settings::{BackgroundPresence, SettingsService};
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
                api.prevent_close();
                dismiss_main_window(&app_handle, tray_settings.background_presence);
            }
            tauri::WindowEvent::Resized(_) => {
                if tray_settings.background_presence == BackgroundPresence::Tray {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if window.is_minimized().unwrap_or(false) {
                            let _ = window.hide();
                            let _ = window.unminimize();
                            #[cfg(target_os = "macos")]
                            sync_macos_dock_visible(&app_handle, false);
                        }
                    }
                }
            }
            _ => {}
        }
    });

    Ok(())
}

/// Hides the main window on launch when started by the login item with --start-hidden.
pub fn apply_start_hidden_if_needed(app: &AppHandle, settings: &SettingsService) {
    if settings.should_start_hidden() {
        hide_main_window(app);
    }
}

#[cfg(target_os = "macos")]
fn sync_macos_dock_visible(app: &AppHandle, visible: bool) {
    use crate::macos_app_icon;

    let policy = if visible {
        ActivationPolicy::Regular
    } else {
        ActivationPolicy::Accessory
    };
    let _ = app.set_activation_policy(policy);
    if visible {
        macos_app_icon::apply_dock_icon();
    }
}

pub fn show_main_window(app: &AppHandle, open_settings: bool) {
    #[cfg(target_os = "macos")]
    {
        sync_macos_dock_visible(app, true);
        let _ = app.show();
    }

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

    #[cfg(target_os = "macos")]
    if let Some(state) = app.try_state::<AppState>() {
        if state.settings.get_tray_settings().background_presence == BackgroundPresence::Tray {
            sync_macos_dock_visible(app, false);
        }
    }
}

pub fn dismiss_main_window(app: &AppHandle, presence: BackgroundPresence) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    match presence {
        BackgroundPresence::Dock => {
            let _ = window.minimize();
        }
        BackgroundPresence::Tray => {
            let _ = window.hide();
            #[cfg(target_os = "macos")]
            sync_macos_dock_visible(app, false);
        }
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
        window_state::persist_main_window_state(app, state.settings.as_ref());
        state.folder_watcher.shutdown();
    }
    app.exit(0);
}

pub fn handle_run_event(app: &AppHandle, event: &RunEvent) {
    #[cfg(target_os = "macos")]
    if let RunEvent::Reopen { .. } = event {
        restore_main_window_on_macos_reopen(app);
        return;
    }

    #[cfg(target_os = "macos")]
    if matches!(event, RunEvent::Ready) {
        crate::macos_app_icon::apply_dock_icon();
    }

    if let RunEvent::ExitRequested { api, code, .. } = event {
        if code.is_none() {
            if let Some(state) = app.try_state::<AppState>() {
                window_state::persist_main_window_state(app, state.settings.as_ref());
                api.prevent_exit();
                dismiss_main_window(app, state.settings.get_tray_settings().background_presence);
            }
        }
    }
}

/// macOS fires `RunEvent::Reopen` when the Dock icon is clicked. Minimized or hidden
/// windows are not automatically restored without this handler.
#[cfg(target_os = "macos")]
pub fn restore_main_window_on_macos_reopen(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let needs_restore = !window.is_visible().unwrap_or(true)
        || window.is_minimized().unwrap_or(false);

    if needs_restore {
        show_main_window(app, false);
    }
}

#[allow(dead_code)]
pub fn focus_main_window(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
}
