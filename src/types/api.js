// API Response Types
export const API_RESPONSE_TYPES = {
  // Base response structure
  BASE_RESPONSE: {
    success: 'boolean',
    error: 'string | null',
    detail: 'string',
    data: 'any',
  },

  // Torrent types
  TORRENT: {
    id: 'number',
    hash: 'string',
    created_at: 'string',
    updated_at: 'string',
    magnet: 'string',
    size: 'number',
    active: 'boolean',
    auth_id: 'string',
    download_state: 'string',
    seeds: 'number',
    peers: 'number',
    ratio: 'number',
    progress: 'number',
    download_speed: 'number',
    upload_speed: 'number',
    name: 'string',
    eta: 'number',
    server: 'number',
    torrent_file: 'boolean',
    expires_at: 'string',
    download_present: 'boolean',
    download_finished: 'boolean',
    files: 'TORRENT_FILE[]',
    inactive_check: 'number',
    availability: 'number',
    private: 'boolean',
    tags: 'TAG[]',
  },

  TORRENT_FILE: {
    id: 'number',
    md5: 'string',
    s3_path: 'string',
    name: 'string',
    size: 'number',
    mimetype: 'string',
    short_name: 'string',
  },

  // Usenet types
  USENET_DOWNLOAD: {
    id: 'number',
    created_at: 'string',
    updated_at: 'string',
    name: 'string',
    size: 'number',
    active: 'boolean',
    download_state: 'string',
    progress: 'number',
    download_speed: 'number',
    eta: 'number',
    server: 'number',
    expires_at: 'string',
    download_present: 'boolean',
    download_finished: 'boolean',
    files: 'USENET_FILE[]',
    tags: 'TAG[]',
  },

  USENET_FILE: {
    id: 'number',
    md5: 'string',
    s3_path: 'string',
    name: 'string',
    size: 'number',
    mimetype: 'string',
    short_name: 'string',
  },

  // Web Download types
  WEB_DOWNLOAD: {
    id: 'number',
    created_at: 'string',
    updated_at: 'string',
    name: 'string',
    size: 'number',
    active: 'boolean',
    download_state: 'string',
    progress: 'number',
    download_speed: 'number',
    eta: 'number',
    server: 'number',
    expires_at: 'string',
    download_present: 'boolean',
    download_finished: 'boolean',
    files: 'WEB_FILE[]',
    original_url: 'string',
    tags: 'TAG[]',
  },

  WEB_FILE: {
    id: 'number',
    md5: 'string',
    s3_path: 'string',
    name: 'string',
    size: 'number',
    mimetype: 'string',
    short_name: 'string',
  },

  // Queued item types
  QUEUED_ITEM: {
    id: 'number',
    created_at: 'string',
    name: 'string',
    size: 'number',
    type: 'string', // 'torrent', 'usenet', 'webdl'
    position: 'number',
    estimated_start: 'string',
  },

  // Notification types
  NOTIFICATION: {
    id: 'number',
    created_at: 'string',
    title: 'string',
    message: 'string',
    type: 'string', // 'info', 'warning', 'error', 'success'
    read: 'boolean',
    data: 'any',
  },

  // RSS Feed types
  RSS_FEED: {
    id: 'number',
    name: 'string',
    url: 'string',
    enabled: 'boolean',
    created_at: 'string',
    updated_at: 'string',
    last_check: 'string',
    item_count: 'number',
    filters: 'RSS_FILTER[]',
  },

  RSS_FILTER: {
    id: 'number',
    feed_id: 'number',
    type: 'string', // 'title', 'description', 'category'
    pattern: 'string',
    enabled: 'boolean',
  },

  RSS_FEED_ITEM: {
    id: 'number',
    feed_id: 'number',
    title: 'string',
    description: 'string',
    link: 'string',
    published_at: 'string',
    category: 'string',
    size: 'number',
    hash: 'string',
    magnet: 'string',
  },

  // User types
  USER_PROFILE: {
    id: 'string',
    email: 'string',
    username: 'string',
    created_at: 'string',
    updated_at: 'string',
    plan: 'string',
    plan_expires_at: 'string',
    active_downloads: 'number',
    max_active_downloads: 'number',
    monthly_downloads: 'number',
    max_monthly_downloads: 'number',
  },

  SUBSCRIPTION: {
    id: 'string',
    plan: 'string',
    status: 'string',
    created_at: 'string',
    expires_at: 'string',
    amount: 'number',
    currency: 'string',
  },

  TRANSACTION: {
    id: 'string',
    type: 'string',
    amount: 'number',
    currency: 'string',
    status: 'string',
    created_at: 'string',
    description: 'string',
  },

  REFERRAL_DATA: {
    code: 'string',
    referrals: 'number',
    earnings: 'number',
    currency: 'string',
  },

  // Search Engine types
  SEARCH_ENGINE: {
    id: 'number',
    name: 'string',
    url: 'string',
    enabled: 'boolean',
    created_at: 'string',
    updated_at: 'string',
    last_check: 'string',
    result_count: 'number',
  },

  // Statistics types
  STATS: {
    total_downloads: 'number',
    total_uploads: 'number',
    total_size: 'number',
    active_downloads: 'number',
    queued_downloads: 'number',
    completed_downloads: 'number',
    failed_downloads: 'number',
  },

  STATS_30_DAYS: {
    date: 'string',
    downloads: 'number',
    uploads: 'number',
    size: 'number',
  },

  // Integration types
  INTEGRATION_JOB: {
    id: 'string',
    hash: 'string',
    type: 'string', // 'google_drive', 'dropbox', 'onedrive', etc.
    status: 'string', // 'pending', 'processing', 'completed', 'failed'
    created_at: 'string',
    updated_at: 'string',
    progress: 'number',
    error: 'string',
  },

  // Cache check types
  CACHED_TORRENT: {
    name: 'string',
    size: 'number',
    hash: 'string',
    files: 'CACHED_FILE[]',
  },

  CACHED_FILE: {
    name: 'string',
    size: 'number',
  },

  // Torrent info types
  TORRENT_INFO: {
    name: 'string',
    hash: 'string',
    size: 'number',
    trackers: 'string[]',
    seeds: 'number',
    peers: 'number',
    files: 'TORRENT_INFO_FILE[]',
  },

  TORRENT_INFO_FILE: {
    name: 'string',
    size: 'number',
  },

  // Tag types
  TAG: {
    id: 'number',
    name: 'string',
    created_at: 'string',
    updated_at: 'string',
    usage_count: 'number',
  },

};

// API Error types
export const API_ERROR_TYPES = {
  DATABASE_ERROR: 'DATABASE_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NO_AUTH: 'NO_AUTH',
  BAD_TOKEN: 'BAD_TOKEN',
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_OPTION: 'INVALID_OPTION',
  REDIRECT_ERROR: 'REDIRECT_ERROR',
  OAUTH_VERIFICATION_ERROR: 'OAUTH_VERIFICATION_ERROR',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  PLAN_RESTRICTED_FEATURE: 'PLAN_RESTRICTED_FEATURE',
  DUPLICATE_ITEM: 'DUPLICATE_ITEM',
  BOZO_RSS_FEED: 'BOZO_RSS_FEED',
  SELLIX_ERROR: 'SELLIX_ERROR',
  TOO_MUCH_DATA: 'TOO_MUCH_DATA',
  DOWNLOAD_TOO_LARGE: 'DOWNLOAD_TOO_LARGE',
  MISSING_REQUIRED_OPTION: 'MISSING_REQUIRED_OPTION',
  TOO_MANY_OPTIONS: 'TOO_MANY_OPTIONS',
  BOZO_TORRENT: 'BOZO_TORRENT',
  NO_SERVERS_AVAILABLE_ERROR: 'NO_SERVERS_AVAILABLE_ERROR',
  MONTHLY_LIMIT: 'MONTHLY_LIMIT',
  COOLDOWN_LIMIT: 'COOLDOWN_LIMIT',
  ACTIVE_LIMIT: 'ACTIVE_LIMIT',
  DOWNLOAD_SERVER_ERROR: 'DOWNLOAD_SERVER_ERROR',
  BOZO_NZB: 'BOZO_NZB',
  SEARCH_ERROR: 'SEARCH_ERROR',
  INVALID_DEVICE: 'INVALID_DEVICE',
  DIFF_ISSUE: 'DIFF_ISSUE',
  LINK_OFFLINE: 'LINK_OFFLINE',
  VENDOR_DISABLED: 'VENDOR_DISABLED',
  BOZO_REGEX: 'BOZO_REGEX',
  BAD_CONFIRMATION: 'BAD_CONFIRMATION',
  CONFIRMATION_EXPIRED: 'CONFIRMATION_EXPIRED',
};

// Download state types
export const DOWNLOAD_STATES = {
  DOWNLOADING: 'downloading',
  UPLOADING: 'uploading',
  STALLED: 'stalled (no seeds)',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  CACHED: 'cached',
  META_DL: 'metaDL',
  CHECKING_RESUME_DATA: 'checkingResumeData',
  FAILED: 'failed',
};

// Operation types
export const OPERATION_TYPES = {
  DELETE: 'delete',
  PAUSE: 'pause',
  RESUME: 'resume',
  REANNOUNCE: 'reannounce',
  STOP_SEEDING: 'stop_seeding',
  START: 'start',
  ENABLE: 'enable',
  DISABLE: 'disable',
};

// Asset types
export const ASSET_TYPES = {
  TORRENTS: 'torrents',
  USENET: 'usenet',
  WEBDL: 'webdl',
};

// Notification types
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
};

// RSS filter types
export const RSS_FILTER_TYPES = {
  TITLE: 'title',
  DESCRIPTION: 'description',
  CATEGORY: 'category',
};

// Integration types
export const INTEGRATION_TYPES = {
  GOOGLE_DRIVE: 'google_drive',
  DROPBOX: 'dropbox',
  ONEDRIVE: 'onedrive',
  GOFILE: 'gofile',
  FICHIER: '1fichier',
  PIXELDRAIN: 'pixeldrain',
};

// Job status types
export const JOB_STATUS_TYPES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
};
