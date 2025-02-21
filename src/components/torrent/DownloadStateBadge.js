import { STATUS_OPTIONS } from './constants';

export default function DownloadStateBadge({ torrent }) {
  const getBadgeStyle = () => {
    // Find matching status from STATUS_OPTIONS
    const status = STATUS_OPTIONS.find(option => {
      if (option.value === 'all') return false;
      
      return Object.entries(option.value).every(([key, value]) => {
        if (key === 'download_state') {
          const states = Array.isArray(value) ? value : [value];
          return states.some(state => torrent.download_state?.includes(state));
        }
        return torrent[key] === value;
      });
    });

    // Return appropriate style based on status
    switch (status?.label) {
      case 'Completed':
        return 'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark';
      case 'Seeding':
      case 'Uploading':
        return 'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark';
      case 'Downloading':
        return 'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark';
      case 'Stalled':
      case 'Inactive':
        return 'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark';
      default:
        return 'bg-label-default-bg dark:bg-label-default-bg-dark text-label-default-text dark:text-label-default-text-dark';
    }
  };

  const getStatus = () => {
    // Find matching status from STATUS_OPTIONS
    const status = STATUS_OPTIONS.find(option => {
      if (option.value === 'all') return false;
      
      return Object.entries(option.value).every(([key, value]) => {
        if (key === 'download_state') {
          const states = Array.isArray(value) ? value : [value];
          return states.some(state => torrent.download_state?.includes(state));
        }
        return torrent[key] === value;
      });
    });

    // Return status label or format download_state if no match
    return status?.label || torrent.download_state?.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') || 'Unknown';
  };

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getBadgeStyle()}`}>
      {getStatus()}
    </span>
  );
} 