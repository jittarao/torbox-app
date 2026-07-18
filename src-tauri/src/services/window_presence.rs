use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};

pub const EVENT_WINDOW_PRESENCE_CHANGED: &str = "desktop://window-presence-changed";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowPresencePayload {
    pub engaged: bool,
}

static LAST_ENGAGED: AtomicBool = AtomicBool::new(true);

pub fn is_window_engaged(window: &WebviewWindow) -> bool {
    let visible = window.is_visible().unwrap_or(true);
    let minimized = window.is_minimized().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(true);
    visible && !minimized && focused
}

pub fn emit_presence_if_changed(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let engaged = is_window_engaged(&window);
    let previous = LAST_ENGAGED.swap(engaged, Ordering::SeqCst);
    if previous == engaged {
        return;
    }

    let _ = app.emit(
        EVENT_WINDOW_PRESENCE_CHANGED,
        WindowPresencePayload { engaged },
    );
}

pub fn handle_window_presence_event(app: &AppHandle, event: &tauri::WindowEvent) {
    match event {
        tauri::WindowEvent::Focused(_)
        | tauri::WindowEvent::Resized(_)
        | tauri::WindowEvent::CloseRequested { .. }
        | tauri::WindowEvent::ScaleFactorChanged { .. } => {
            emit_presence_if_changed(app);
        }
        _ => {}
    }
}
