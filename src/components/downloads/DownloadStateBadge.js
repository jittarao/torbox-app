import { STATUS_OPTIONS } from '@/components/constants';
import { useTranslations } from 'next-intl';

export default function DownloadStateBadge({ item, size = 'default' }) {
  const t = useTranslations('Statuses');

  // Check if essential fields are missing, indicating a queued torrent
  const isQueued =
    !item.download_state && !item.download_finished && !item.active;

  // Find matching status from STATUS_OPTIONS
  const getMatchingStatus = () => {
    if (isQueued) return { label: 'queued' };

    // First check for specific download states
    const stateSpecificStatus = STATUS_OPTIONS.find((option) => {
      if (!option.value.download_state) return false;

      const states = Array.isArray(option.value.download_state)
        ? option.value.download_state
        : [option.value.download_state];

      return states.some((state) =>
        item.download_state?.toLowerCase().includes(state.toLowerCase()),
      );
    });

    if (stateSpecificStatus) return stateSpecificStatus;

    // Then check for other status conditions
    return STATUS_OPTIONS.find((option) => {
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
  };

  const status = getMatchingStatus();

  // Map status labels to their corresponding styles
  const styleMap = {
    Completed:
      'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark',
    Seeding:
      'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark',
    Uploading:
      'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark',
    Downloading:
      'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Checking_Resume_Data:
      'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Meta_DL:
      'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Queued:
      'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark',
    Stalled:
      'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark',
    Inactive:
      'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark',
  };

  const badgeStyle =
    styleMap[status?.label] ||
    'bg-label-default-bg dark:bg-label-default-bg-dark text-label-default-text dark:text-label-default-text-dark';
  const statusText =
    t(`${status?.label.toLowerCase()}`) ||
    item.download_state
      ?.split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ') ||
    t('unknown');

  // Size variants
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] leading-4 font-medium',
    sm: 'px-1.5 py-0.5 text-xs leading-4 font-medium',
    default: 'px-2 py-0.5 text-xs leading-5 font-semibold',
  };

  return (
    <span
      className={`inline-flex rounded-full w-fit ${badgeStyle} ${sizeClasses[size] || sizeClasses.default}`}
    >
      {statusText}
    </span>
  );
}
