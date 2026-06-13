'use client';

import { useState } from 'react';
import { useDownloadsActions } from './DownloadsActionsContext';
import { useDownloadsContext } from './DownloadsContext';
import { useDownloadsUIContext } from './DownloadsUIContext';
import { controlTorrent, controlQueuedItem } from '@/utils/uploadActions';
import { canRetryDownload, retryDownload } from '@/utils/retryDownload';
import { phEvent } from '@/utils/sa';
import ItemActionButtons from './ItemActionButtons';
import MoreOptionsDropdown from './MoreOptionsDropdown';
import { useTranslations } from 'next-intl';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemAssetType, getIdFieldForItem } from '@/store/torboxDownloadsSelectors';
import { removeQueuedAfterForceStart } from '@/store/downloadListReconcile';

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
  const [isRetrying, setIsRetrying] = useState(false);
  const { downloadSingle } = useDownloadsActions();
  const { archiveItem, isArchiving } = useDownloadsContext();
  const { isBackendAvailable } = useDownloadsUIContext();
  const t = useTranslations('ItemActions');

  const itemAssetType = resolveItemAssetType(item, activeType);
  const showArchive =
    isBackendAvailable && item.hash && (activeType === 'torrents' || itemAssetType === 'torrents');

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
    const assetType = resolveItemAssetType(item, activeType);
    const result = await controlQueuedItem(apiKey, item.id, 'start', assetType);
    if (!result) {
      setToast({ message: t('toast.downloadFailed'), type: 'error' });
      return;
    }
    setToast({
      message: result.success
        ? t('toast.downloadStarted')
        : result.userMessage || result.error || t('toast.downloadFailed'),
      type: result.success ? 'success' : 'error',
    });
    if (result.success) {
      removeQueuedAfterForceStart(assetType, [item.id]);
    }
  };

  // Stops seeding a torrent
  const handleStopSeeding = async () => {
    if (activeType !== 'torrents') return;
    const result = await controlTorrent(apiKey, item.id, 'stop_seeding');
    if (!result) {
      setToast({ message: t('toast.seedingStopFailed'), type: 'error' });
      return;
    }
    setToast({
      message: result.success
        ? t('toast.seedingStopped')
        : result.userMessage || result.error || t('toast.seedingStopFailed'),
      type: result.success ? 'success' : 'error',
    });
    if (result.success) {
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

  const handleArchive = async () => {
    if (isArchiving) return;
    await archiveItem(item);
    phEvent('archive_item');
  };

  const showRetry = canRetryDownload(item, activeType);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const result = await retryDownload(apiKey, item, activeType);
      if (result.success) {
        setToast({
          message: t('toast.retrySuccess'),
          type: 'success',
        });
        phEvent('retry_download_item');
        return;
      }

      if (result.error === 'source_url_unavailable') {
        setToast({
          message: t('toast.retrySourceUnavailable'),
          type: 'error',
        });
        return;
      }

      setToast({
        message: result.userMessage || t('toast.retryFailed'),
        type: 'error',
      });
    } catch (error) {
      console.error('Error retrying download:', error);
      setToast({
        message: t('toast.retryFailed'),
        type: 'error',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const showStopSeeding =
    activeType === 'torrents' && item.download_finished && item.download_present && item.active;
  const showForceStart = activeType === 'torrents' && !item.download_state;
  const hasCardActions = showStopSeeding || showForceStart || showRetry || item.download_present;

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
      onRetry={handleRetry}
      showRetry={showRetry}
      isRetrying={isRetrying}
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
      showArchive={showArchive}
      onArchive={handleArchive}
      isArchiving={isArchiving}
      showRetry={showRetry}
      onRetry={handleRetry}
      isRetrying={isRetrying}
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
