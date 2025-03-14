'use client';

import { useState } from 'react';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useUpload } from '../shared/hooks/useUpload';
import { phEvent } from '@/utils/sa';
import ItemActionButtons from './ItemActionButtons';
import MoreOptionsDropdown from './MoreOptionsDropdown';
import { useTranslations } from 'next-intl';

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
  viewMode,
  downloadHistory,
  setDownloadHistory,
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    setDownloadHistory,
  );
  const { controlTorrent, controlQueuedItem } = useUpload(apiKey);
  const t = useTranslations('ItemActions');

  // Downloads a torrent or a webdl/usenet item
  const handleDownload = async () => {
    if (!item.files || item.files.length === 0) {
      setToast({
        message: t('toast.noFiles'),
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

    const metadata = {
      assetType: activeType,
      item: item,
    };
    // If there's only one file, download it directly
    if (item.files.length === 1) {
      await downloadSingle(
        item.id,
        { fileId: item.files[0].id },
        idField,
        false,
        metadata,
      );
      return;
    } else {
      // Otherwise, download the item as a zip
      await downloadSingle(item.id, { fileId: null }, idField, false, metadata);
    }
  };

  // Forces a torrent or a webdl/usenet item to start downloading
  const handleForceStart = async () => {
    const result = await controlQueuedItem(item.id, 'start');
    setToast({
      message: result.success
        ? t('toast.downloadStarted')
        : t('toast.downloadFailed'),
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
        ? t('toast.seedingStopped')
        : t('toast.seedingStopFailed'),
      type: result.success ? 'success' : 'error',
    });
    if (!result.success) {
      throw new Error(result.error);
    } else {
      setItems((prev) =>
        prev.map((localItem) =>
          localItem.id === item.id
            ? { ...localItem, active: false }
            : localItem,
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
      phEvent('delete_item');
    } catch (error) {
      console.error('Error deleting:', error);
      setToast({
        message: t('toast.deleteError', { error: error.message }),
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
        viewMode={viewMode}
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
