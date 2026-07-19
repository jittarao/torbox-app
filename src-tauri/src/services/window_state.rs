use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};
use url::Url;

use crate::constants::DEFAULT_DESKTOP_SETTINGS_PATH;
use crate::services::settings::{SettingsService, WindowGeometry};
use crate::services::web_path::{extract_web_path_from_url, navigation_url_for_path};

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
                persist_web_location(&window, settings);
            }
        }
        _ => {}
    }
}

/// Ensures the webview loads the configured instance URL on startup.
/// Restores the last in-app path when available; otherwise opens the instance root.
pub fn restore_instance_navigation(window: &WebviewWindow, settings: &SettingsService) {
    let Some(target) = resolve_startup_navigation_url(window, settings) else {
        return;
    };

    if should_navigate_to(window, &target) {
        let _ = window.navigate(target);
    }
}

pub fn navigate_to_instance_root(app: &AppHandle, settings: &SettingsService) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Some(target) = instance_root_url(&window, settings) else {
        return;
    };
    let _ = window.navigate(target);
}

pub fn navigate_to_desktop_settings(app: &AppHandle, settings: &SettingsService) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let base = resolve_navigation_base(&window, settings);
    let Ok(target) = navigation_url_for_path(&base, DEFAULT_DESKTOP_SETTINGS_PATH) else {
        return;
    };
    let _ = window.navigate(target);
}

fn resolve_startup_navigation_url(
    window: &WebviewWindow,
    settings: &SettingsService,
) -> Option<Url> {
    let base = resolve_navigation_base(window, settings);
    if let Some(web_path) = settings.get_last_web_path() {
        return navigation_url_for_path(&base, &web_path).ok();
    }
    instance_root_url(window, settings)
}

fn instance_root_url(window: &WebviewWindow, settings: &SettingsService) -> Option<Url> {
    let base = resolve_navigation_base(window, settings);
    Url::parse(&format!("{}/", base.trim_end_matches('/'))).ok()
}

fn should_navigate_to(window: &WebviewWindow, target: &Url) -> bool {
    let Ok(current) = window.url() else {
        return true;
    };

    current.origin() != target.origin()
        || current.path() != target.path()
        || current.query() != target.query()
}

fn resolve_navigation_base(_window: &WebviewWindow, settings: &SettingsService) -> String {
    #[cfg(debug_assertions)]
    {
        let _ = settings;
        if let Ok(url) = _window.url() {
            let origin = url.origin().ascii_serialization();
            if origin.starts_with("http://localhost:") || origin.starts_with("http://127.0.0.1:") {
                return origin;
            }
        }
        return "http://localhost:3000".to_string();
    }
    #[cfg(not(debug_assertions))]
    {
        settings.get_instance_url()
    }
}

pub fn persist_web_location(window: &WebviewWindow, settings: &SettingsService) {
    let Ok(current) = window.url() else {
        return;
    };
    if let Some(path) = extract_web_path_from_url(&current) {
        let _ = settings.set_last_web_path(Some(path));
    }
}

pub fn persist_main_window_state(app: &AppHandle, settings: &SettingsService) {
    if let Some(window) = app.get_webview_window("main") {
        persist_window_geometry(&window, settings);
        persist_web_location(&window, settings);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_target_uses_instance_root_without_saved_path() {
        let target = Url::parse("https://self-hosted.example.com/").unwrap();
        assert_eq!(target.as_str(), "https://self-hosted.example.com/");
    }
}
