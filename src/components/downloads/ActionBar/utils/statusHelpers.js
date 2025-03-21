import { STATUS_OPTIONS } from '@/components/constants';

export const getMatchingStatus = (item) => {
  const isQueued =
    !item.download_state && !item.download_finished && !item.active;
  if (isQueued)
    return {
      label: 'Queued',
      value: {
        is_queued: true,
      },
      hidden: false,
    };

  // First check for specific download states
  const stateSpecificStatus = STATUS_OPTIONS.find((option) => {
    if (!option.value.download_state) return false;

    const states = Array.isArray(option.value.download_state)
      ? option.value.download_state
      : [option.value.download_state];

    const stateMatches = states.some((state) =>
      item.download_state?.toLowerCase().includes(state.toLowerCase()),
    );

    const activeMatches =
      option.value.active === undefined || option.value.active === item.active;

    return stateMatches && activeMatches;
  });

  if (stateSpecificStatus) return stateSpecificStatus;

  // Then check for other status conditions
  const status = STATUS_OPTIONS.find((option) => {
    if (
      option.value === 'all' ||
      option.value.is_queued ||
      option.value.download_state
    )
      return false;

    return Object.entries(option.value).every(
      ([key, value]) => item[key] === value,
    );
  });

  if (status) return status;
  return { label: 'unknown' };
};

export const getStatusStyles = (status) => {
  switch (status) {
    case 'Downloading':
    case 'Uploading':
      return 'text-label-warning-text dark:text-label-warning-text-dark'; // Yellow
    case 'Seeding':
    case 'Queued':
      return 'text-label-active-text dark:text-label-active-text-dark'; // Blue
    case 'Completed':
      return 'text-label-success-text dark:text-label-success-text-dark'; // Green
    case 'Failed':
    case 'Inactive':
    case 'Stalled':
      return 'text-label-danger-text dark:text-label-danger-text-dark'; // Red
    default:
      return 'text-label-default-text dark:text-label-default-text-dark'; // Gray
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
