import { useTranslations } from 'next-intl';
import { getMatchingStatus } from '@/components/downloads/ActionBar/utils/statusHelpers';

export default function DownloadStateBadge({ item, size = 'default' }) {
  const t = useTranslations('Statuses');

  const status = getMatchingStatus(item);

  const greenStyle =
    'bg-label-success-bg dark:bg-label-success-bg-dark text-label-success-text dark:text-label-success-text-dark';
  const yellowStyle =
    'bg-label-warning-bg dark:bg-label-warning-bg-dark text-label-warning-text dark:text-label-warning-text-dark';
  const blueStyle =
    'bg-label-active-bg dark:bg-label-active-bg-dark text-label-active-text dark:text-label-active-text-dark';
  const redStyle =
    'bg-label-danger-bg dark:bg-label-danger-bg-dark text-label-danger-text dark:text-label-danger-text-dark';
  const grayStyle =
    'bg-label-default-bg dark:bg-label-default-bg-dark text-label-default-text dark:text-label-default-text-dark';

  // Map status labels to their corresponding styles
  const styleMap = {
    Completed: greenStyle,
    Seeding: blueStyle,
    Queued: blueStyle,
    Uploading: yellowStyle,
    Downloading: yellowStyle,
    Checking_Resume_Data: yellowStyle,
    Meta_DL: yellowStyle,
    Stalled: redStyle,
    Inactive: redStyle,
    Failed: redStyle,
  };

  const badgeStyle = styleMap[status?.label] || grayStyle;
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
