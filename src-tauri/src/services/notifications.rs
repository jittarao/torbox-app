use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::constants::APP_DISPLAY_NAME;
use crate::services::settings::{NotificationSettings, SettingsService};

#[derive(Clone, Copy)]
pub enum UploadNotificationKind {
    Success,
    Failure,
}

pub struct NotificationService {
    settings: Arc<SettingsService>,
}

impl NotificationService {
    pub fn new(settings: Arc<SettingsService>) -> Self {
        Self { settings }
    }

    pub fn get_settings(&self) -> NotificationSettings {
        self.settings.get_notification_settings()
    }

    pub fn set_settings(&self, settings: NotificationSettings) -> Result<(), String> {
        self.settings.set_notification_settings(settings)
    }

    pub fn show_upload_notification(
        &self,
        app: &AppHandle,
        kind: UploadNotificationKind,
        filename: &str,
        error: Option<&str>,
    ) {
        let prefs = self.settings.get_notification_settings();
        if !prefs.native_notifications {
            return;
        }

        let (title, body) = match kind {
            UploadNotificationKind::Success if prefs.notify_on_upload_success => (
                "Torrent uploaded",
                format!("{filename} was uploaded successfully."),
            ),
            UploadNotificationKind::Failure if prefs.notify_on_upload_failure => (
                "Torrent upload failed",
                format!("{filename}: {}", error.unwrap_or("Upload failed")),
            ),
            _ => return,
        };

        let _ = self.show_native_notification(app, &title, &body);
    }

    pub fn show_test_notification(&self, app: &AppHandle) -> Result<(), String> {
        self.show_native_notification(
            app,
            APP_DISPLAY_NAME,
            "Desktop notifications are working.",
        )
    }

    fn show_native_notification(
        &self,
        app: &AppHandle,
        title: &str,
        body: &str,
    ) -> Result<(), String> {
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| format!("Failed to show notification: {e}"))
    }
}

pub fn notification_permission_hint() -> &'static str {
    if cfg!(target_os = "macos") {
        "Enable notifications for TorBox Manager in System Settings → Notifications."
    } else {
        "Enable notifications for TorBox Manager in your system settings."
    }
}
