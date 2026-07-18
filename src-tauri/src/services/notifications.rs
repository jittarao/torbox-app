use std::sync::Arc;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use crate::constants::APP_DISPLAY_NAME;
use crate::services::settings::{NotificationSettings, SettingsService};

#[derive(Clone, Copy)]
#[allow(dead_code)]
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

    #[allow(dead_code)]
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

    pub fn show_batch_upload_notification(
        &self,
        app: &AppHandle,
        success_count: u32,
        failure_count: u32,
        single_filename: Option<&str>,
        first_error: Option<&str>,
    ) {
        let prefs = self.settings.get_notification_settings();
        if !prefs.native_notifications {
            return;
        }

        if success_count == 0 && failure_count == 0 {
            return;
        }

        let (title, body) = if success_count > 0 && failure_count == 0 {
            if !prefs.notify_on_upload_success {
                return;
            }
            if success_count == 1 {
                let filename = single_filename.unwrap_or("Torrent");
                (
                    "Torrent uploaded".to_string(),
                    format!("{filename} was uploaded successfully."),
                )
            } else {
                (
                    "Torrents uploaded".to_string(),
                    format!("{success_count} torrents were uploaded successfully."),
                )
            }
        } else if success_count == 0 && failure_count > 0 {
            if !prefs.notify_on_upload_failure {
                return;
            }
            if failure_count == 1 {
                let filename = single_filename.unwrap_or("Torrent");
                (
                    "Torrent upload failed".to_string(),
                    format!(
                        "{filename}: {}",
                        first_error.unwrap_or("Upload failed")
                    ),
                )
            } else {
                (
                    "Torrent uploads failed".to_string(),
                    format!(
                        "{failure_count} torrent uploads failed{}",
                        first_error
                            .map(|error| format!(": {error}"))
                            .unwrap_or_default()
                    ),
                )
            }
        } else {
            let mut parts = Vec::new();
            if success_count > 0 && prefs.notify_on_upload_success {
                parts.push(format!("{success_count} uploaded"));
            }
            if failure_count > 0 && prefs.notify_on_upload_failure {
                parts.push(format!("{failure_count} failed"));
            }
            if parts.is_empty() {
                return;
            }
            let title = "Torrent upload batch".to_string();
            let mut body = parts.join(", ");
            if let Some(error) = first_error {
                body.push_str(&format!(" ({error})"));
            }
            (title, body)
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

    pub fn show_torbox_notification(
        &self,
        app: &AppHandle,
        title: &str,
        body: &str,
    ) -> Result<(), String> {
        let prefs = self.settings.get_notification_settings();
        if !prefs.native_notifications || !prefs.notify_on_torbox_notifications {
            return Ok(());
        }

        self.show_native_notification(app, title, body)
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
