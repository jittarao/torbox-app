export const API_BASE = 'https://api.torbox.app';
export const API_SEARCH_BASE = 'https://search-api.torbox.app';
export const API_VERSION = 'v1';

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
  id: { label: 'ID', sortable: true },
  hash: { label: 'Hash', sortable: true, assetTypes: ['torrents'] },
  name: { label: 'Name', sortable: true },
  size: { label: 'Size', sortable: true },
  created_at: { label: 'Added Date', sortable: true },
  updated_at: { label: 'Last Updated', sortable: true },
  download_state: { label: 'Status', sortable: true },
  progress: { label: 'Progress', sortable: true },
  ratio: { label: 'Ratio', sortable: true, assetTypes: ['torrents'] },
  file_count: { label: 'File Count', sortable: true },
  download_speed: { label: 'Download Speed', sortable: true },
  upload_speed: {
    label: 'Upload Speed',
    sortable: true,
    assetTypes: ['torrents'],
  },
  eta: { label: 'ETA', sortable: true },
  total_uploaded: {
    label: 'Total Uploaded',
    sortable: true,
    assetTypes: ['torrents'],
  },
  total_downloaded: {
    label: 'Total Downloaded',
    sortable: true,
    assetTypes: ['torrents'],
  },
  seeds: { label: 'Seeds', sortable: true, assetTypes: ['torrents'] },
  peers: { label: 'Peers', sortable: true, assetTypes: ['torrents'] },
  original_url: {
    label: 'Source URL',
    sortable: true,
    assetTypes: ['webdl', 'usenet'],
  },
  expires_at: { label: 'Expires At', sortable: true },
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

export const Icons = {
  magnifying_glass: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  ),
  files: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  ),
  download: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  ),
  upload: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  ),
  delete: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  play: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  ),
  stop: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  question: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  ),
  copy: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  ),
  vertical_ellipsis: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
  check: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  times: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  refresh: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  maximize: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" x2="14" y1="3" y2="10" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  ),
  minimize: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" x2="21" y1="10" y2="3" />
      <line x1="3" x2="10" y1="21" y2="14" />
    </svg>
  ),
  table: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  ),
  list: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M21 9H3" />
      <path d="M21 15H3" />
    </svg>
  ),
  eye: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  ),
  eyeOff: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};
