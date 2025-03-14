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
  isMobile = false,
  onStopSeeding,
  onForceStart,
  onDownload,
  viewMode,
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

  return (
    <>
      {/* Stop seeding button */}
      {activeType === 'torrents' &&
        item.download_finished &&
        item.download_present &&
        item.active && (
          <button
            onClick={handleStopSeeding}
            disabled={isStopping}
            className={`text-red-400 dark:text-red-400 
              hover:text-red-600 dark:hover:text-red-500 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'w-full flex items-center justify-center py-1' : ''}`}
            title={t('stop.title')}
          >
            {isStopping ? <Spinner size="sm" /> : <Icons.Stop />}
            {isMobile && (
              <span className="ml-2 text-xs">{t('stop.label')}</span>
            )}
          </button>
        )}

      {/* Force start button */}
      {activeType === 'torrents' && !item.download_state && (
        <button
          onClick={handleForceStart}
          disabled={isDownloading}
          className={`stroke-2 text-accent dark:text-accent-dark 
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'w-full flex items-center justify-center py-1' : ''}`}
          title={t('start.title')}
        >
          {isDownloading ? <Spinner size="sm" /> : <Icons.Play />}
          {isMobile && <span className="ml-2 text-xs">{t('start.label')}</span>}
        </button>
      )}

      {/* Toggle files button */}
      {item.download_present && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFiles(item.id);
          }}
          className={`p-1.5 rounded-full text-primary-text/70 dark:text-primary-text-dark/70 
            hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors
            ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={expandedItems.has(item.id) ? t('files.hide') : t('files.show')}
        >
          {expandedItems.has(item.id) ? (
            <Icons.ChevronUp />
          ) : (
            <Icons.ChevronDown />
          )}
          {isMobile && (
            <span className="ml-2 text-xs">
              {expandedItems.has(item.id) ? t('files.hide') : t('files.label')}
            </span>
          )}
        </button>
      )}

      {/* Download button */}
      {item.download_present && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
          hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
          ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={t('download.title')}
        >
          {isDownloading ? <Spinner size="sm" /> : <Icons.Download />}
          {isMobile && (
            <span className="ml-2 text-xs">{t('download.label')}</span>
          )}
        </button>
      )}

      {/* Delete button */}
      <ConfirmButton
        onClick={handleDelete}
        isLoading={isDeleting}
        confirmIcon={<Icons.Check />}
        defaultIcon={<Icons.Delete />}
        className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
          disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
        title={t('delete.title')}
        isMobile={isMobile}
        mobileText={t('delete.label')}
      />
    </>
  );
}
