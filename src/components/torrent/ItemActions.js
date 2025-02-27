'use client';

import { useState } from 'react';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useUpload } from '../shared/hooks/useUpload';
import { saEvent } from '@/utils/sa';
import ItemActionButtons from './ItemActionButtons';
import MoreOptionsDropdown from './MoreOptionsDropdown';

export default function ItemActions({
  item,
  apiKey,
  onDelete,
  toggleFiles,
  expandedItems,
  setItems,
  setToast,
  activeType = 'torrents',
  isMobile = false,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
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
  const handleForceStart = async () => {
    const result = await controlQueuedItem(item.id, 'start');
    setToast({
      message: result.success
        ? 'Download started successfully'
        : 'Download start failed',
      type: result.success ? 'success' : 'error',
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  // Stops seeding a torrent
  const handleStopSeeding = async () => {
    if (activeType !== 'torrents') return;
    const result = await controlTorrent(item.id, 'stop_seeding');
    setToast({
      message: result.success
        ? 'Torrent stopped seeding successfully'
        : 'Torrent stop seeding failed',
      type: result.success ? 'success' : 'error',
    });
    if (!result.success) {
      throw new Error(result.error);
    } else {
      setItems((prev) =>
        prev.map((item) =>
          item.id === item.id ? { ...item, active: false } : item,
        ),
      );
    }
  };

  // Deletes a torrent or a webdl/usenet item
  const handleDelete = async (e) => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      await onDelete(item.id);
      saEvent('delete_item');
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
      <ItemActionButtons
        item={item}
        onDelete={handleDelete}
        isDeleting={isDeleting}
        toggleFiles={toggleFiles}
        expandedItems={expandedItems}
        activeType={activeType}
        isMobile={isMobile}
        onStopSeeding={handleStopSeeding}
        onForceStart={handleForceStart}
        onDownload={handleDownload}
      />

      <MoreOptionsDropdown
        item={item}
        apiKey={apiKey}
        setToast={setToast}
        isMobile={isMobile}
        activeType={activeType}
      />
    </div>
  );
}
