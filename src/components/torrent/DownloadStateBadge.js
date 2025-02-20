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
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'Seeding':
      case 'Uploading':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'Downloading':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'Stalled':
      case 'Inactive':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
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