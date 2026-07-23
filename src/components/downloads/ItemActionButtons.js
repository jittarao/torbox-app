import { useState } from 'react';
import Check from '@/components/icons/Check';
import ChevronDown from '@/components/icons/ChevronDown';
import ChevronUp from '@/components/icons/ChevronUp';
import Delete from '@/components/icons/Delete';
import Download from '@/components/icons/Download';
import Files from '@/components/icons/Files';
import Play from '@/components/icons/Play';
import Refresh from '@/components/icons/Refresh';
import Stop from '@/components/icons/Stop';
import Spinner from '@/components/shared/Spinner';
import ConfirmButton from '@/components/shared/ConfirmButton';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';
import { getItemFileCount } from '@/utils/downloadEntityFiles';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

const mobileIconButtonClass =
  'ui-header-icon-btn !h-11 !w-11 !min-w-11 shrink-0 touch-manipulation';

const mobileDownloadButtonClass =
  'ui-header-icon-btn !h-12 !w-12 !min-w-12 shrink-0 touch-manipulation text-accent dark:text-accent-dark [&_svg]:size-6 hover:bg-accent/10 dark:hover:bg-accent-dark/10 active:bg-accent/15 dark:active:bg-accent-dark/15';

const mobileFilesButtonClass =
  'ui-header-icon-btn !h-11 shrink-0 touch-manipulation !w-auto !min-w-0 px-2.5 gap-1 text-xs font-medium text-primary-text/70 dark:text-primary-text-dark/70 [&_svg]:size-3.5';

export default function ItemActionButtons({
  item,
  onDelete,
  itemState,
  toggleFiles,
  activeType = 'torrents',
  onStopSeeding,
  onForceStart,
  onRetry,
  onDownload,
  compact = false,
  mobileBar = false,
}) {
  const {
    deleting: isDeleting,
    expanded: isExpanded = false,
    protected: isProtected = false,
    showRetry = false,
    retrying: isRetrying = false,
  } = itemState;
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

  const handleRetry = async (e) => {
    e.stopPropagation();
    if (!onRetry) return;
    try {
      await onRetry();
    } catch {
      // ItemActions handles toast/errors
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      await onDownload();
      phEvent('download_item');
    } finally {
      setIsDownloading(false);
    }
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

  const fileCount = getItemFileCount(item);
  const filesExpanded = isExpanded;
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
            disabled={isProtected}
            confirmIcon={<Check />}
            defaultIcon={<Stop />}
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
          {isDownloading ? <Spinner size="sm" /> : <Play />}
        </button>
      )}

      {/* Retry button for inactive/failed torrents and web downloads */}
      {showRetry && onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className={`${tableIconButtonClass} text-accent dark:text-accent-dark
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed`}
          title={t('retry.title')}
        >
          {isRetrying ? <Spinner size="sm" /> : <Refresh />}
        </button>
      )}

      {/* Download — on card for mobileBar; in row for desktop */}
      {item.download_present && (!compact || mobileBar) && (
        <button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className={
            mobileBar
              ? mobileDownloadButtonClass
              : `${tableIconButtonClass} text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5`
          }
          title={t('download.title')}
          aria-label={t('download.label')}
        >
          {isDownloading ? <Spinner size="sm" /> : <Download />}
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
          aria-label={mobileBar ? filesLabel : undefined}
          aria-expanded={filesExpanded}
          aria-controls={filesExpanded ? `files-${getDownloadSelectionId(item)}` : undefined}
        >
          {mobileBar ? (
            <>
              <Files className="shrink-0 opacity-70" aria-hidden />
              <span className="tabular-nums">{fileCount ?? '—'}</span>
              {filesExpanded ? (
                <ChevronUp className="shrink-0 opacity-50" aria-hidden />
              ) : (
                <ChevronDown className="shrink-0 opacity-50" aria-hidden />
              )}
            </>
          ) : filesExpanded ? (
            <ChevronUp />
          ) : (
            <ChevronDown />
          )}
        </button>
      )}

      {!compact && (
        <ConfirmButton
          onClick={handleDelete}
          isLoading={isDeleting}
          disabled={isProtected}
          confirmIcon={<Check />}
          defaultIcon={<Delete />}
          className={`${tableIconButtonClass} text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200`}
          title={t('delete.title')}
        />
      )}
    </>
  );
}
