'use client';

import { useState } from 'react';
import { useDownloadsActions } from './DownloadsActionsContext';
import { controlTorrent, controlQueuedItem } from '@/utils/uploadActions';
import { phEvent } from '@/utils/sa';
import ItemActionButtons from './ItemActionButtons';
import MoreOptionsDropdown from './MoreOptionsDropdown';
import { useTranslations } from 'next-intl';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemAssetType, getIdFieldForItem } from '@/store/torboxDownloadsSelectors';

export default function ItemActions({
  item,
  apiKey,
  onDelete,
  toggleFiles,
  isExpanded = false,
  setToast,
  activeType = 'torrents',
  compact = false,
  mobileBar = false,
}) {
  const patchItem = useTorboxDownloadsStore((state) => state.patchItem);
  const [isDeleting, setIsDeleting] = useState(false);
  const { downloadSingle } = useDownloadsActions();
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

    const idField = getIdFieldForItem(item, activeType);
    const resolvedAssetType = resolveItemAssetType(item, activeType);

    const metadata = {
      assetType: resolvedAssetType,
      item: item,
    };
    // If there's only one file, download it directly
    if (item.files.length === 1) {
      await downloadSingle(item.id, { fileId: item.files[0].id }, idField, false, metadata);
      return;
    } else {
      // Otherwise, download the item as a zip
      await downloadSingle(item.id, { fileId: null }, idField, false, metadata);
    }
  };

  // Forces a torrent or a webdl/usenet item to start downloading
  const handleForceStart = async () => {
    const result = await controlQueuedItem(apiKey, item.id, 'start');
    setToast({
      message: result.success ? t('toast.downloadStarted') : t('toast.downloadFailed'),
      type: result.success ? 'success' : 'error',
    });
    if (!result.success) {
      throw new Error(result.error);
    }
  };

  // Stops seeding a torrent
  const handleStopSeeding = async () => {
    if (activeType !== 'torrents') return;
    const result = await controlTorrent(apiKey, item.id, 'stop_seeding');
    setToast({
      message: result.success ? t('toast.seedingStopped') : t('toast.seedingStopFailed'),
      type: result.success ? 'success' : 'error',
    });
    if (!result.success) {
      throw new Error(result.error);
    } else {
      patchItem(resolveItemAssetType(item, activeType), item.id, {
        active: false,
        download_state: 'completed',
        download_present: true,
      });
    }
  };

  // Deletes a torrent or a webdl/usenet item
  const handleDelete = async (e) => {
    if (isDeleting) return;
    setIsDeleting(true);

    try {
      // For 'all' type, pass the item's assetType to the delete function
      const itemAssetType = activeType === 'all' ? item.assetType : null;
      await onDelete(item.id, false, itemAssetType);
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

  const showStopSeeding =
    activeType === 'torrents' &&
    item.download_finished &&
    item.download_present &&
    item.active;
  const showForceStart = activeType === 'torrents' && !item.download_state;
  const hasCardActions = showStopSeeding || showForceStart || item.download_present;

  const actionButtons = (
    <ItemActionButtons
      item={item}
      onDelete={handleDelete}
      isDeleting={isDeleting}
      toggleFiles={toggleFiles}
      isExpanded={isExpanded}
      activeType={activeType}
      onStopSeeding={handleStopSeeding}
      onForceStart={handleForceStart}
      onDownload={handleDownload}
      compact={compact || mobileBar}
      mobileBar={mobileBar}
    />
  );

  const moreMenu = (
    <MoreOptionsDropdown
      item={item}
      apiKey={apiKey}
      setToast={setToast}
      activeType={activeType}
      compact={compact && !mobileBar}
      mobileBar={mobileBar}
      showDownload={compact && !mobileBar && item.download_present}
      onDownload={handleDownload}
      showDelete={compact || mobileBar}
      onDelete={handleDelete}
      isDeleting={isDeleting}
    />
  );

  if (mobileBar) {
    return (
      <div
        className={`flex items-center gap-2 w-full min-w-0 ${hasCardActions ? '' : 'justify-end'}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {actionButtons}
        {moreMenu}
      </div>
    );
  }

  return (
    <>
      {actionButtons}
      {moreMenu}
    </>
  );
}
