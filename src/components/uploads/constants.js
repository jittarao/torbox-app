export const STATUS_COLORS = {
  queued:
    'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark',
  processing:
    'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
  completed:
    'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark',
  failed:
    'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark',
};

export const TYPE_LABELS = {
  torrent: 'Torrent',
  usenet: 'Usenet',
  webdl: 'WebDL',
};

export const STATUS_TABS = ['queued', 'completed', 'failed'];
