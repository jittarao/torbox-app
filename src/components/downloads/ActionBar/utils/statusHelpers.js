import { STATUS_OPTIONS } from '@/components/constants';
import { isQueuedItem } from '@/utils/utility';

/** Map transitional download states to the user-facing Downloading label for filters. */
export function normalizeStatusLabelForFilter(label) {
  if (label === 'Meta_DL' || label === 'Checking_Resume_Data') {
    return 'downloading';
  }
  return String(label || '').toLowerCase();
}

export const getMatchingStatus = (item) => {
  if (isQueuedItem(item))
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
      item.download_state?.toLowerCase().includes(state.toLowerCase())
    );

    const activeMatches = option.value.active === undefined || option.value.active === item.active;

    return stateMatches && activeMatches;
  });

  if (stateSpecificStatus) return stateSpecificStatus;

  // Then check for other status conditions
  const status = STATUS_OPTIONS.find((option) => {
    if (option.value === 'all' || option.value.is_queued || option.value.download_state)
      return false;

    return Object.entries(option.value).every(([key, value]) => item[key] === value);
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
    case 'all':
      return 'download';
    case 'usenet':
      return 'usenet';
    case 'webdl':
      return 'web download';
    default:
      return 'torrent';
  }
};

const getTotalSelectedFiles = (selectedItems) => {
  return Array.from(selectedItems.files.values()).reduce((total, files) => total + files.size, 0);
};

/** Torrent is finished, present on disk, and actively seeding (matches ItemActions stop-seeding affordance). */
export function isTorrentSeeding(item) {
  return Boolean(item?.download_finished && item?.download_present && item.active);
}

/** Torrent is queued (matches status filter / ItemActions force-start affordance on torrents tab). */
export function isTorrentQueued(item) {
  return isQueuedItem(item);
}

/** Inactive or failed TorBox download status (matches STATUS_OPTIONS labels). */
export function isInactiveOrFailed(item) {
  const status = getMatchingStatus(item);
  return status.label === 'Inactive' || status.label === 'Failed';
}
