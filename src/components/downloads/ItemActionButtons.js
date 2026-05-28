import { useState } from 'react';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import ConfirmButton from '@/components/shared/ConfirmButton';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';

const mobileIconButtonClass = 'ui-header-icon-btn !h-11 !w-11 !min-w-11 shrink-0 touch-manipulation';

const mobileFilesButtonClass =
  'flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-medium text-primary-text/75 dark:text-primary-text-dark/75 touch-manipulation transition-colors hover:bg-zinc-100/80 active:bg-zinc-100 dark:hover:bg-white/[0.06] dark:active:bg-white/[0.08]';

export default function ItemActionButtons({
  item,
  onDelete,
  isDeleting,
  toggleFiles,
  expandedItems,
  activeType = 'torrents',
  onStopSeeding,
  onForceStart,
  onDownload,
  compact = false,
  mobileBar = false,
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const t = useTranslations('ItemActionButtons');

  const handleStopSeeding = async (e) => {
    e.stopPropagation();
    setIsStopping(true);
    try {
      await onStopSeeding();
      phEvent('stop_seeding_item');
    } finally {
      setIsStopping(false);
    }
  };

  const handleForceStart = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      await onForceStart();
      phEvent('force_start_item');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    await onDownload();
    phEvent('download_item');
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    await onDelete();
  };

  const tableIconButtonClass = mobileBar
    ? mobileIconButtonClass
    : compact
      ? 'shrink-0 p-1 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4'
      : 'shrink-0 p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const fileCount = item.files?.length ?? item.file_count;
  const filesExpanded = expandedItems.has(item.id);
  const filesLabel = filesExpanded
    ? t('files.hide')
    : fileCount != null && fileCount > 0
      ? t('files.count', { count: fileCount })
      : t('files.label');

  return (
    <>
      {/* Stop seeding button */}
      {activeType === 'torrents' &&
        item.download_finished &&
        item.download_present &&
        item.active && (
          <ConfirmButton
            onClick={handleStopSeeding}
            isLoading={isStopping}
            confirmIcon={<Icons.Check />}
            defaultIcon={<Icons.Stop />}
            className={`${tableIconButtonClass} text-red-400 dark:text-red-400 hover:text-red-600 dark:hover:text-red-500
              hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200`}
            title={t('stop.title')}
          />
        )}

      {/* Force start button */}
      {activeType === 'torrents' && !item.download_state && (
        <button
          type="button"
          onClick={handleForceStart}
          disabled={isDownloading}
          className={`${tableIconButtonClass} stroke-2 text-accent dark:text-accent-dark 
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed`}
          title={t('start.title')}
        >
          {isDownloading ? <Spinner size="sm" /> : <Icons.Play />}
        </button>
      )}

      {/* Toggle files button */}
      {item.download_present && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFiles(item.id);
          }}
          className={
            mobileBar
              ? mobileFilesButtonClass
              : `${tableIconButtonClass} text-primary-text/70 dark:text-primary-text-dark/70 
            hover:bg-primary-text/10 dark:hover:bg-primary-text-dark/10 hover:text-primary-text dark:hover:text-primary-text-dark`
          }
          title={filesExpanded ? t('files.hide') : t('files.show')}
          aria-expanded={filesExpanded}
        >
          {mobileBar ? (
            <>
              <span className="min-w-0 truncate">{filesLabel}</span>
              {filesExpanded ? (
                <Icons.ChevronUp className="size-4 shrink-0 opacity-50" />
              ) : (
                <Icons.ChevronDown className="size-4 shrink-0 opacity-50" />
              )}
            </>
          ) : filesExpanded ? (
            <Icons.ChevronUp />
          ) : (
            <Icons.ChevronDown />
          )}
        </button>
      )}

      {/* Download / delete — hidden on compact mobile; surfaced in MoreOptionsDropdown */}
      {!compact && item.download_present && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className={`${tableIconButtonClass} text-accent dark:text-accent-dark 
          hover:bg-accent/5 dark:hover:bg-accent-dark/5`}
          title={t('download.title')}
        >
          {isDownloading ? <Spinner size="sm" /> : <Icons.Download />}
        </button>
      )}

      {!compact && (
        <ConfirmButton
          onClick={handleDelete}
          isLoading={isDeleting}
          confirmIcon={<Icons.Check />}
          defaultIcon={<Icons.Delete />}
          className={`${tableIconButtonClass} text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200`}
          title={t('delete.title')}
        />
      )}
    </>
  );
}
