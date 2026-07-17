use serde::Serialize;
use tauri::{AppHandle, State, WebviewWindow};

use crate::constants::{MINIMUM_SUPPORTED_WEB_BRIDGE_VERSION, PROTOCOL_VERSION};
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloResponse {
    pub protocol_version: u32,
    pub app_version: String,
    pub build_channel: String,
    pub platform: String,
    pub capabilities: serde_json::Value,
    pub minimum_supported_web_bridge_version: u32,
    pub instance_url: String,
}

fn platform_name() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

fn build_capabilities() -> serde_json::Value {
    serde_json::json!({
        "protocolVersion": PROTOCOL_VERSION,
        "features": {
            "secureCredentials": {
                "version": 1,
                "canStoreApiKey": true
            },
            "instanceUrl": {
                "version": 1,
                "canCustomize": true
            }
        }
    })
}

#[tauri::command]
pub fn desktop_hello(app: AppHandle, state: State<AppState>) -> Result<HelloResponse, String> {
    let instance_url = state.settings.get_instance_url();
    let app_version = app.package_info().version.to_string();
    let build_channel = if cfg!(debug_assertions) {
        "dev"
    } else {
        "stable"
    };

    Ok(HelloResponse {
        protocol_version: PROTOCOL_VERSION,
        app_version,
        build_channel: build_channel.to_string(),
        platform: platform_name().to_string(),
        capabilities: build_capabilities(),
        minimum_supported_web_bridge_version: MINIMUM_SUPPORTED_WEB_BRIDGE_VERSION,
        instance_url,
    })
}

pub fn validate_window_origin(window: &WebviewWindow, state: &AppState) -> Result<(), String> {
    let stored = state.settings.get_instance_url();
    let current = window
        .url()
        .map_err(|e| format!("Failed to read webview URL: {e}"))?;

    let current_origin = url::Url::parse(current.as_str())
        .map_err(|_| "Invalid webview URL".to_string())?
        .origin()
        .ascii_serialization();

    let stored_origin = url::Url::parse(&stored)
        .map_err(|_| "Invalid stored instance URL".to_string())?
        .origin()
        .ascii_serialization();

    #[cfg(debug_assertions)]
    {
        let dev_origins = ["http://localhost:3000", "http://127.0.0.1:3000"];
        if dev_origins.contains(&current_origin.as_str()) {
            return Ok(());
        }
    }

    if current_origin != stored_origin {
        return Err("Origin does not match configured instance URL".into());
    }

    Ok(())
}
