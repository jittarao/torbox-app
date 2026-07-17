use tauri::{AppHandle, ipc::CapabilityBuilder, Manager};

use crate::constants::DEFAULT_INSTANCE_URL;

const BRIDGE_PERMISSIONS: &[&str] = &["core:default", "core:event:default", "allow-desktop-bridge"];

fn bridge_capability(identifier: &str) -> CapabilityBuilder {
    let mut builder = CapabilityBuilder::new(identifier)
        .windows(["main"])
        .local(false);

    for permission in BRIDGE_PERMISSIONS {
        builder = builder.permission(*permission);
    }

    builder
}

fn register_remote_origin(app: &AppHandle, identifier: &str, origin: &str) -> Result<(), String> {
    let capability = bridge_capability(identifier)
        .remote(origin.to_string())
        .remote(format!("{origin}/*"));

    app.add_capability(capability).map_err(|e| {
        format!("Failed to register remote capability for {origin}: {e}")
    })
}

/// Registers dev-only localhost origins (debug builds only).
pub fn register_dev_capabilities(app: &AppHandle) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        for origin in ["http://localhost:3000", "http://127.0.0.1:3000"] {
            register_remote_origin(app, &format!("dev-{origin}"), origin)?;
        }
    }

    Ok(())
}

/// Registers IPC access for a persisted custom HTTPS instance origin.
pub fn register_custom_instance_capability(
    app: &AppHandle,
    instance_url: &str,
) -> Result<(), String> {
    if instance_url == DEFAULT_INSTANCE_URL {
        return Ok(());
    }

    register_remote_origin(app, "custom-instance", instance_url)
}
