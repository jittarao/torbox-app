import { useState } from 'react';
import Icons from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import ConfirmButton from '@/components/shared/ConfirmButton';
import { phEvent } from '@/utils/sa';
import { useTranslations } from 'next-intl';

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

  const tableIconButtonClass =
    'shrink-0 p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

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
          className={`${tableIconButtonClass} text-primary-text/70 dark:text-primary-text-dark/70 
            hover:bg-primary-text/10 dark:hover:bg-primary-text-dark/10 hover:text-primary-text dark:hover:text-primary-text-dark`}
          title={expandedItems.has(item.id) ? t('files.hide') : t('files.show')}
        >
          {expandedItems.has(item.id) ? <Icons.ChevronUp /> : <Icons.ChevronDown />}
        </button>
      )}

      {/* Download button */}
      {item.download_present && (
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

      {/* Delete button */}
      <ConfirmButton
        onClick={handleDelete}
        isLoading={isDeleting}
        confirmIcon={<Icons.Check />}
        defaultIcon={<Icons.Delete />}
        className={`${tableIconButtonClass} text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200`}
        title={t('delete.title')}
      />
    </>
  );
}
