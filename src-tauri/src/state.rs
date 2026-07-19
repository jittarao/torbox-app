use std::sync::{Arc, RwLock};

use crate::services::folder_watcher::FolderWatcherService;
use crate::services::notifications::NotificationService;
use crate::services::settings::SettingsService;

pub struct AppState {
    pub settings: Arc<SettingsService>,
    pub folder_watcher: FolderWatcherService,
    pub notifications: NotificationService,
    /// Origin of the loaded web app for this process lifetime (survives instance URL changes until restart).
    pub session_web_origin: RwLock<Option<String>>,
}
