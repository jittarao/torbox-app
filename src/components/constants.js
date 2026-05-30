export {
  REFERRAL_CODE,
  REFERRAL_LINK,
  REFERRAL_SIGNUP_LINK,
} from '@/config/referral';
export const REFERRAL_HELP_URL =
  'https://support.torbox.app/en/articles/9875657-how-does-the-torbox-referral-system-work';
export const ABUSE_POLICY_URL =
  'https://support.torbox.app/en/articles/10336778-the-torbox-abuse-system';
export const GITHUB_REPO_URL = 'https://github.com/jittarao/torbox-app';

export {
  API_BASE,
  API_SEARCH_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
  FETCH_TIMEOUT_MS,
} from '@/config/apiConstants';

export { NON_RETRYABLE_ERRORS } from '@/config/errors';

// Columns for the downloads page
export const COLUMNS = {
  id: { key: 'id', sortable: true },
  hash: { key: 'hash', sortable: true, assetTypes: ['torrents', 'all'] },
  name: { key: 'name', sortable: true },
  size: { key: 'size', sortable: true },
  created_at: { key: 'created_at', sortable: true },
  cached_at: { key: 'cached_at', sortable: true },
  updated_at: { key: 'updated_at', sortable: true },
  download_state: { key: 'download_state', sortable: true },
  progress: { key: 'progress', sortable: true, displayName: 'Progress' },
  download_progress: { key: 'download_progress', sortable: true, displayName: 'Detailed Progress' },
  ratio: { key: 'ratio', sortable: true, assetTypes: ['torrents', 'all'] },
  file_count: { key: 'file_count', sortable: true },
  download_speed: { key: 'download_speed', sortable: true },
  upload_speed: {
    key: 'upload_speed',
    sortable: true,
    assetTypes: ['torrents', 'all'],
  },
  eta: { key: 'eta', sortable: true },
  total_uploaded: {
    key: 'total_uploaded',
    sortable: true,
    assetTypes: ['torrents', 'all'],
  },
  total_downloaded: {
    key: 'total_downloaded',
    sortable: true,
    assetTypes: ['torrents', 'all'],
  },
  seeds: { key: 'seeds', sortable: true, assetTypes: ['torrents', 'all'] },
  peers: { key: 'peers', sortable: true, assetTypes: ['torrents', 'all'] },
  original_url: {
    key: 'original_url',
    sortable: true,
    assetTypes: ['webdl', 'usenet'],
  },
  tracker: {
    key: 'tracker',
    sortable: true,
    assetTypes: ['torrents', 'all'],
    displayName: 'Tracker URL',
  },
  expires_at: { key: 'expires_at', sortable: true },
  asset_type: { key: 'asset_type', sortable: true, assetTypes: ['all'] },
  private: { key: 'private', sortable: true, assetTypes: ['torrents', 'all'] },
  tags: { key: 'tags', sortable: false },
};

// Status options for the downloads page
export const STATUS_OPTIONS = [
  { label: 'All', value: 'all', hidden: true },
  // Queued: Missing download state and other status fields
  {
    label: 'Queued',
    value: {
      is_queued: true, // Special flag we'll check for
    },
    hidden: false,
  },
  // Completed: Download finished, not active
  {
    label: 'Completed',
    value: {
      download_finished: true,
      download_present: true,
      active: false,
    },
    hidden: false,
  },
  // Downloading: Downloading, not finished, active
  {
    label: 'Downloading',
    value: {
      active: true,
      download_finished: false,
      download_present: false,
    },
    hidden: false,
  },
  // Seeding: Download finished, seeding enabled, active
  {
    label: 'Seeding',
    value: {
      download_finished: true,
      download_present: true,
      active: true,
    },
    hidden: false,
  },
  // Uploading: Download finished, uploading, active
  {
    label: 'Uploading',
    value: {
      download_finished: true,
      download_present: false,
      active: true,
    },
    hidden: false,
  },
  // Stalled: Download or upload is stalled
  {
    label: 'Stalled',
    value: {
      download_state: ['stalled', 'stalledDL', 'stalled (no seeds)'],
      active: true,
      download_finished: false,
      download_present: false,
    },
    hidden: false,
  },
  // Missing: Download finished, Download not present
  {
    label: 'Inactive',
    value: {
      active: false,
      download_present: false,
    },
    hidden: false,
  },
  // Failed: Download failed
  {
    label: 'Failed',
    value: {
      download_state: ['failed'],
      active: false,
      download_finished: false,
      download_present: false,
    },
    hidden: false,
  },
  // MetaDL: Downloading metadata
  { label: 'Meta_DL', value: { download_state: ['metaDL'] }, hidden: true },
  // Checking Resume Data: Checking resumable data
  {
    label: 'Checking_Resume_Data',
    value: { download_state: ['checkingResumeData'] },
    hidden: true,
  },
];
