use std::sync::Arc;

use crate::services::notifications::NotificationService;
use crate::services::settings::SettingsService;
use crate::services::folder_watcher::FolderWatcherService;

pub struct AppState {
    pub settings: Arc<SettingsService>,
    pub folder_watcher: FolderWatcherService,
    pub notifications: NotificationService,
}
