'use client';

import { useState } from 'react';
import { Icons } from '@/components/constants';
import Spinner from '../shared/Spinner';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useUpload } from '../shared/hooks/useUpload';
import { saEvent } from '@/utils/sa';

export default function ItemActions({
  item,
  apiKey,
  onDelete,
  toggleFiles,
  expandedItems,
  setToast,
  activeType = 'torrents',
  isMobile = false,
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const { downloadSingle } = useDownloads(apiKey, activeType);
  const { controlTorrent, controlQueuedItem } = useUpload(apiKey);

  // Downloads a torrent or a webdl/usenet item
  const handleDownload = async () => {
    if (!item.files || item.files.length === 0) {
      setToast({
        message: 'No files available to download',
        type: 'error',
      });
      return;
    }

    const idField =
      activeType === 'usenet'
        ? 'usenet_id'
        : activeType === 'webdl'
          ? 'web_id'
          : 'torrent_id';

    // If there's only one file, download it directly
    if (item.files.length === 1) {
      await downloadSingle(item.id, { fileId: item.files[0].id }, idField);
      return;
    } else {
      // Otherwise, download the item as a zip
      await downloadSingle(item.id, { fileId: null }, idField);
    }
  };

  // Forces a torrent or a webdl/usenet item to start downloading
  const forceStart = async () => {
    setIsDownloading(true);
    try {
      const result = await controlQueuedItem(item.id, 'start');
      setToast({
        message: `Download started successfully`,
        type: 'success',
      });
      if (!result.success) {
        setToast({
          message: `Download start failed`,
          type: 'error',
        });
        throw new Error(result.error);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Stops seeding a torrent
  const handleStopSeeding = async () => {
    if (activeType !== 'torrents') return;
    setIsStopping(true);
    try {
      const result = await controlTorrent(item.id, 'stop_seeding');
      setToast({
        message: 'Torrent stopped seeding successfully',
        type: 'success',
      });
      if (!result.success) {
        setToast({
          message: 'Torrent stop seeding failed',
          type: 'error',
        });
        throw new Error(result.error);
      }
    } finally {
      setIsStopping(false);
    }
  };

  // Deletes a torrent or a webdl/usenet item
  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } catch (error) {
      console.error('Error deleting:', error);
      setToast({
        message: `Error deleting: ${error.message}`,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-end space-x-2'}`}
    >
      {activeType === 'torrents' &&
        item.download_finished &&
        item.download_present &&
        item.active && (
          <button
            onClick={() => {
              handleStopSeeding(item.id);
              saEvent('stop_seeding_item');
            }}
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

      {activeType === 'torrents' && !item.download_state && (
        <button
          onClick={() => {
            forceStart(item.id);
            saEvent('force_start_item');
          }}
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

      {item.download_present && (
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

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDownload();
          saEvent('download_item');
        }}
        className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
          hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
          ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
        title="Download"
      >
        {isDownloading ? <Spinner size="sm" /> : Icons.download}
        {isMobile && <span className="ml-2 text-xs">Download</span>}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          handleDelete();
          saEvent('delete_item');
        }}
        disabled={isDeleting}
        className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
          hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-colors
          disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
        title="Delete"
      >
        {isDeleting ? <Spinner size="sm" /> : Icons.delete}
        {isMobile && <span className="ml-2 text-xs">Delete</span>}
      </button>
    </div>
  );
}
