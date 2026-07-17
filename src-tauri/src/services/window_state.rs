use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

use crate::services::settings::{SettingsService, WindowGeometry};

const GEOMETRY_SAVE_DEBOUNCE_MS: u64 = 500;

static GEOMETRY_SAVE_GENERATION: AtomicU64 = AtomicU64::new(0);

pub fn restore_window_geometry(window: &WebviewWindow, settings: &SettingsService) {
    let geometry = settings.get_window_geometry();
    if let Some((width, height)) = geometry.clamped_size() {
        let _ = window.set_size(Size::Physical(PhysicalSize { width, height }));
    }
    if let (Some(x), Some(y)) = (geometry.x, geometry.y) {
        let _ = window.set_position(Position::Physical(PhysicalPosition { x, y }));
    }
}

pub fn persist_window_geometry(window: &WebviewWindow, settings: &SettingsService) {
    let Ok(size) = window.inner_size() else {
        return;
    };
    let Ok(position) = window.outer_position() else {
        return;
    };

    let geometry = WindowGeometry::from_physical(
        size.width,
        size.height,
        position.x,
        position.y,
    );
    let _ = settings.set_window_geometry(geometry);
}

pub fn schedule_geometry_save(app: &AppHandle, settings: &Arc<SettingsService>) {
    let generation = GEOMETRY_SAVE_GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    let settings = Arc::clone(settings);

    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(GEOMETRY_SAVE_DEBOUNCE_MS)).await;
        if GEOMETRY_SAVE_GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        if let Some(window) = app.get_webview_window("main") {
            persist_window_geometry(&window, &settings);
        }
    });
}

pub fn handle_window_geometry_event(
    app: &AppHandle,
    settings: &Arc<SettingsService>,
    event: &tauri::WindowEvent,
) {
    match event {
        tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
            schedule_geometry_save(app, settings);
        }
        tauri::WindowEvent::CloseRequested { .. } => {
            if let Some(window) = app.get_webview_window("main") {
                persist_window_geometry(&window, settings);
            }
        }
        _ => {}
    }
}

pub fn persist_main_window_geometry(app: &AppHandle, settings: &SettingsService) {
    if let Some(window) = app.get_webview_window("main") {
        persist_window_geometry(&window, settings);
    }
}
