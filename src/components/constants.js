export const API_BASE = 'https://api.torbox.app';
export const API_SEARCH_BASE = 'https://search-api.torbox.app';
export const API_VERSION = 'v1';
export const TORBOX_MANAGER_VERSION = '1.0';

export const NON_RETRYABLE_ERRORS = {
  DATABASE_ERROR: 'DATABASE_ERROR',
  NO_AUTH: 'NO_AUTH',
  BAD_TOKEN: 'BAD_TOKEN',
  AUTH_ERROR: 'AUTH_ERROR',
  INVALID_OPTION: 'INVALID_OPTION',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  PLAN_RESTRICTED_FEATURE: 'PLAN_RESTRICTED_FEATURE',
  DUPLICATE_ITEM: 'DUPLICATE_ITEM',
  TOO_MUCH_DATA: 'TOO_MUCH_DATA',
  DOWNLOAD_TOO_LARGE: 'DOWNLOAD_TOO_LARGE',
  MISSING_REQUIRED_OPTION: 'MISSING_REQUIRED_OPTION',
  TOO_MANY_OPTIONS: 'TOO_MANY_OPTIONS',
  MONTHLY_LIMIT: 'MONTHLY_LIMIT',
  COOLDOWN_LIMIT: 'COOLDOWN_LIMIT',
  ACTIVE_LIMIT: 'ACTIVE_LIMIT',
  DOWNLOAD_SERVER_ERROR: 'DOWNLOAD_SERVER_ERROR',
  INVALID_DEVICE: 'INVALID_DEVICE',
  DIFF_ISSUE: 'DIFF_ISSUE',
  VENDOR_DISABLED: 'VENDOR_DISABLED',
};

export const COLUMNS = {
  id: { key: 'id', sortable: true },
  hash: { key: 'hash', sortable: true, assetTypes: ['torrents'] },
  name: { key: 'name', sortable: true },
  size: { key: 'size', sortable: true },
  created_at: { key: 'created_at', sortable: true },
  updated_at: { key: 'updated_at', sortable: true },
  download_state: { key: 'download_state', sortable: true },
  progress: { key: 'progress', sortable: true },
  ratio: { key: 'ratio', sortable: true, assetTypes: ['torrents'] },
  file_count: { key: 'file_count', sortable: true },
  download_speed: { key: 'download_speed', sortable: true },
  upload_speed: {
    key: 'upload_speed',
    sortable: true,
    assetTypes: ['torrents'],
  },
  eta: { key: 'eta', sortable: true },
  total_uploaded: {
    key: 'total_uploaded',
    sortable: true,
    assetTypes: ['torrents'],
  },
  total_downloaded: {
    key: 'total_downloaded',
    sortable: true,
    assetTypes: ['torrents'],
  },
  seeds: { key: 'seeds', sortable: true, assetTypes: ['torrents'] },
  peers: { key: 'peers', sortable: true, assetTypes: ['torrents'] },
  original_url: {
    key: 'original_url',
    sortable: true,
    assetTypes: ['webdl', 'usenet'],
  },
  expires_at: { key: 'expires_at', sortable: true },
};

export const STATUS_OPTIONS = [
  { label: 'All', value: 'all' },
  // Queued: Missing download state and other status fields
  {
    label: 'Queued',
    value: {
      is_queued: true, // Special flag we'll check for
    },
  },
  // Completed: Download finished, not active
  {
    label: 'Completed',
    value: {
      download_finished: true,
      download_present: true,
      active: false,
    },
  },
  // Downloading: Downloading, not finished, active
  {
    label: 'Downloading',
    value: {
      download_finished: false,
      active: true,
    },
  },
  // Seeding: Download finished, seeding enabled, active
  {
    label: 'Seeding',
    value: {
      download_finished: true,
      download_present: true,
      active: true,
    },
  },
  // Uploading: Download finished, uploading, active
  {
    label: 'Uploading',
    value: {
      download_finished: true,
      download_present: false,
      active: true,
    },
  },
  // Stalled: Download or upload is stalled
  {
    label: 'Stalled',
    value: {
      download_state: ['stalled', 'stalled (no seeds)'],
    },
  },
  // Missing: Download finished, Download not present
  {
    label: 'Inactive',
    value: {
      download_finished: true,
      download_present: false,
      active: false,
    },
  },
  { label: 'Failed', value: { download_state: ['failed'] } },
];
