pub const APP_DISPLAY_NAME: &str = "TorBox Manager";
pub const BUNDLE_IDENTIFIER: &str = "tools.tbm.desktop";
pub const LEGACY_LAUNCH_AGENT_LABEL: &str = "torbox-manager";
pub const DEFAULT_INSTANCE_URL: &str = "https://tbm.tools";
pub const PROTOCOL_VERSION: u32 = 1;
pub const MINIMUM_SUPPORTED_WEB_BRIDGE_VERSION: u32 = 1;
#[cfg_attr(debug_assertions, allow(dead_code))]
pub const KEYRING_SERVICE: &str = "tools.tbm.desktop";
#[cfg_attr(debug_assertions, allow(dead_code))]
pub const KEYRING_USER: &str = "api-key";
pub const MAX_TORRENT_FILE_BYTES: u64 = 10_485_760;
pub const DEFAULT_STABLE_FILE_MS: u64 = 2000;
pub const WATCHER_PROCESSED_RETENTION_DAYS: i64 = 30;
pub const WATCHER_MAX_RETRIES: u32 = 3;
pub const WATCHER_RATE_LIMIT_MAX_RETRIES: u32 = 10;
pub const WATCHER_ACTIVITY_LOG_LIMIT: usize = 10;
/// Idle delay after the last watch-folder event before flushing a batch.
pub const WATCHER_BATCH_COALESCE_MS: u64 = 1500;
/// Short follow-up delay when more than one batch worth of paths remain pending.
pub const WATCHER_BATCH_DRAIN_MS: u64 = 100;
pub const MIN_STABLE_FILE_MS: u64 = 500;
pub const MAX_STABLE_FILE_MS: u64 = 60_000;

pub const MIN_WINDOW_WIDTH: u32 = 900;
pub const MIN_WINDOW_HEIGHT: u32 = 600;

/// Passed only by the OS login item / autostart entry, never on manual launches.
pub const START_HIDDEN_LAUNCH_ARG: &str = "--start-hidden";

/// Matches `uploads.length > 1000` validation in Next.js and backend batch routes.
pub const MAX_BATCH_UPLOADS_PER_REQUEST: usize = 1000;
/// Matches backend `UPLOAD_RATE_LIMIT_MAX` default (requests per 15-minute window).
#[allow(dead_code)]
pub const UPLOAD_HTTP_RATE_LIMIT_MAX: u32 = 1000;
#[allow(dead_code)]
pub const UPLOAD_HTTP_RATE_LIMIT_WINDOW_SECS: u64 = 15 * 60;
/// Default wait when a 429 is returned without Retry-After / RateLimit-Reset headers.
pub const UPLOAD_RATE_LIMIT_DEFAULT_RETRY_SECS: u64 = 60;
