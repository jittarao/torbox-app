import { STATUS_OPTIONS } from './constants';

export default function DownloadStateBadge({ torrent }) {
  // Check if essential fields are missing, indicating a queued torrent
  const isQueued = torrent.type === 'torrent' && 
    !torrent.download_state && 
    !torrent.download_finished && 
    !torrent.active;

  // Find matching status from STATUS_OPTIONS
  const getMatchingStatus = () => {
    if (isQueued) return { label: 'Queued' };

    return STATUS_OPTIONS.find(option => {
      if (option.value === 'all' || option.value.is_queued) return false;
      
      return Object.entries(option.value).every(([key, value]) => {
        if (key === 'download_state') {
          const states = Array.isArray(value) ? value : [value];
          return states.some(state => torrent.download_state?.includes(state));
        }
        return torrent[key] === value;
      });
    });
  };

  const status = getMatchingStatus();

  // Map status labels to their corresponding styles
  const styleMap = {
    Completed: 'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark',
    Seeding: 'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark',
    Uploading: 'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark',
    Downloading: 'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Queued: 'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Stalled: 'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark',
    Inactive: 'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark'
  };

  const badgeStyle = styleMap[status?.label] || 'bg-label-default-bg dark:bg-label-default-bg-dark text-label-default-text dark:text-label-default-text-dark';
  const statusText = status?.label || torrent.download_state?.split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || 'Unknown';

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeStyle}`}>
      {statusText}
    </span>
  );
} 