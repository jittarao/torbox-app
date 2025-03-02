import { STATUS_OPTIONS } from '@/components/constants';

export const getMatchingStatus = (item) => {
  const isQueued =
    !item.download_state && !item.download_finished && !item.active;
  if (isQueued) return { label: 'Queued' };

  return STATUS_OPTIONS.find((option) => {
    if (option.value === 'all' || option.value.is_queued) return false;

    return Object.entries(option.value).every(([key, value]) => {
      if (key === 'download_state') {
        const states = Array.isArray(value) ? value : [value];
        return states.some((state) => item.download_state?.includes(state));
      }
      return item[key] === value;
    });
  });
};

export const getStatusStyles = (status) => {
  switch (status) {
    case 'Queued':
    case 'Downloading':
      return 'text-label-warning-text dark:text-label-warning-text-dark';
    case 'Seeding':
    case 'Uploading':
      return 'text-label-active-text dark:text-label-active-text-dark';
    case 'Completed':
      return 'text-label-success-text dark:text-label-success-text-dark';
    case 'Failed':
    case 'Inactive':
      return 'text-label-danger-text dark:text-label-danger-text-dark';
    default:
      return 'text-label-default-text dark:text-label-default-text-dark';
  }
};

export const getItemTypeName = (activeType) => {
  switch (activeType) {
    case 'usenet':
      return 'usenet';
    case 'webdl':
      return 'web download';
    default:
      return 'torrent';
  }
};

export const getTotalSelectedFiles = (selectedItems) => {
  return Array.from(selectedItems.files.values()).reduce(
    (total, files) => total + files.size,
    0,
  );
};
