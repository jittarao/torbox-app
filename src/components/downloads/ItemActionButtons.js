import { useState } from 'react';
import { Icons } from '@/components/constants';
import Spinner from '../shared/Spinner';
import ConfirmButton from '../shared/ConfirmButton';
import { phEvent } from '@/utils/sa';

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

  const handleStopSeeding = async () => {
    setIsStopping(true);
    try {
      await onStopSeeding();
      phEvent('stop_seeding_item');
    } finally {
      setIsStopping(false);
    }
  };

  const handleForceStart = async () => {
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
            title="Stop seeding"
          >
            {isStopping ? <Spinner size="sm" /> : Icons.stop}
            {isMobile && <span className="ml-2 text-xs">Stop</span>}
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
          title="Force Start"
        >
          {isDownloading ? <Spinner size="sm" /> : Icons.play}
          {isMobile && <span className="ml-2 text-xs">Start</span>}
        </button>
      )}

      {/* Toggle files button */}
      {item.download_present && viewMode === 'table' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFiles(item.id);
          }}
          className={`p-1.5 rounded-full text-primary-text/70 dark:text-primary-text-dark/70 
            hover:bg-surface-alt dark:hover:bg-surface-alt-dark hover:text-primary-text dark:hover:text-primary-text-dark transition-colors
            ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={expandedItems.has(item.id) ? 'Hide Files' : 'Show Files'}
        >
          {expandedItems.has(item.id) ? Icons.files : Icons.files}
          {isMobile && (
            <span className="ml-2 text-xs">
              {expandedItems.has(item.id) ? 'Hide Files' : 'Files'}
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
          title="Download"
        >
          {isDownloading ? <Spinner size="sm" /> : Icons.download}
          {isMobile && <span className="ml-2 text-xs">Download</span>}
        </button>
      )}

      {/* Delete button */}
      <ConfirmButton
        onClick={onDelete}
        isLoading={isDeleting}
        confirmIcon={Icons.check}
        defaultIcon={Icons.delete}
        className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
          disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
        title="Delete"
        isMobile={isMobile}
        mobileText="Delete"
      />
    </>
  );
}
