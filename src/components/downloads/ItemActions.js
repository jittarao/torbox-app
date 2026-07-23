'use client';

import { readJsonFromResponse } from '@/utils/fetchResponse';

import { useState, useCallback, memo } from 'react';
import { useDownloadsActions } from './DownloadsActionsContext';
import { useDownloadsContext } from './DownloadsContext';
import { useDownloadsUIContext } from './DownloadsUIContext';
import { controlQueuedItem } from '@/utils/uploadActions';
import { canRetryDownload, retryDownload } from '@/utils/retryDownload';
import { phEvent } from '@/utils/sa';
import ItemActionButtons from './ItemActionButtons';
import MoreOptionsDropdown from './MoreOptionsDropdown';
import { useTranslations } from 'next-intl';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { resolveItemFiles } from '@/utils/downloadEntityFiles';
import { resolveItemAssetType, getIdFieldForItem } from '@/store/torboxDownloadsSelectors';
import { removeQueuedAfterForceStart } from '@/store/downloadListReconcile';
import { isQueuedItem } from '@/utils/utility';
import { AIRLOCK_LIMIT_REACHED_ERROR } from '@/config/errors';
import { isItemProtected } from '@/utils/downloadProtectionUtils';

function normalizeBooleanValue(value) {
  return value === true || value === 1 || value === 'true';
}

function normalizeUiAssetType(assetType) {
  return assetType === 'torrent' ? 'torrents' : assetType;
}

function ItemActions({
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
  const [isAirlockUpdating, setIsAirlockUpdating] = useState(false);
  const { downloadSingle } = useDownloadsActions();
  const {
    archiveItem,
    isArchiving,
    stopSeedingItem,
    toggleProtectionForItem,
    isUpdatingProtection,
  } = useDownloadsContext();
  const { isBackendAvailable } = useDownloadsUIContext();
  const t = useTranslations('ItemActions');

  const itemAssetType = resolveItemAssetType(item, activeType);
  const showArchive =
    isBackendAvailable && item.hash && (activeType === 'torrents' || itemAssetType === 'torrents');
  const showProtection = isBackendAvailable;
  const itemProtected = isItemProtected(item);

  // Downloads a torrent or a webdl/usenet item
  const handleDownload = async () => {
    const files = resolveItemFiles(item, useTorboxDownloadsStore.getState().filesByEntityKey);
    if (!files.length) {
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
      item: { ...item, files },
    };
    // If there's only one file, download it directly
    if (files.length === 1) {
      await downloadSingle(item.id, { fileId: files[0].id }, idField, false, metadata);
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
    await stopSeedingItem(item);
    phEvent('stop_seeding_item');
  };

  // Deletes a torrent or a webdl/usenet item
  const handleDelete = async (e) => {
    if (isDeleting || itemProtected) return;
    setIsDeleting(true);

    try {
      // For 'all' type, pass the item's assetType to the delete function
      const itemAssetType = activeType === 'all' ? item.assetType : null;
      await onDelete(item.id, false, itemAssetType, item);
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
    if (isArchiving || itemProtected) return;
    await archiveItem(item);
    phEvent('archive_item');
  };

  const handleToggleProtection = async () => {
    if (isUpdatingProtection) return;
    await toggleProtectionForItem(item);
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

  const handleToggleAirlock = async () => {
    if (isAirlockUpdating || isQueuedItem(item)) return;

    const resolvedAssetType = resolveItemAssetType(item, activeType);
    const uiAssetType = normalizeUiAssetType(resolvedAssetType);
    const nextAirlocked = !normalizeBooleanValue(item.airlocked);
    setIsAirlockUpdating(true);
    patchItem(uiAssetType, item.id, { airlocked: nextAirlocked });

    try {
      const response = await fetch('/api/downloads/airlock', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          assetType: resolvedAssetType,
          id: item.id,
          airlocked: nextAirlocked,
        }),
      });
      const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

      if (!responseOk || data.success === false) {
        if (data.error === AIRLOCK_LIMIT_REACHED_ERROR) {
          patchItem(uiAssetType, item.id, { airlocked: !nextAirlocked });
          setToast({
            message: data.detail || t('toast.airlockLimitReached'),
            type: 'error',
          });
          return;
        }
        throw new Error(data.error || data.detail || 'Airlock update failed');
      }

      setToast({
        message: nextAirlocked ? t('toast.airlockLocked') : t('toast.airlockUnlocked'),
        type: 'success',
      });
      phEvent(nextAirlocked ? 'lock_download_item' : 'unlock_download_item');
    } catch (error) {
      console.error('Error updating airlock:', error);
      patchItem(uiAssetType, item.id, { airlocked: !nextAirlocked });
      setToast({
        message: t('toast.airlockFailed', { error: error.message }),
        type: 'error',
      });
    } finally {
      setIsAirlockUpdating(false);
    }
  };

  const showStopSeeding =
    activeType === 'torrents' && item.download_finished && item.download_present && item.active;
  const showForceStart = activeType === 'torrents' && !item.download_state;
  const showAirlock = !isQueuedItem(item);
  const itemAirlocked = normalizeBooleanValue(item.airlocked);
  const hasCardActions = showStopSeeding || showForceStart || showRetry || item.download_present;

  const actionButtons = (
    <ItemActionButtons
      item={item}
      onDelete={handleDelete}
      itemState={{
        deleting: isDeleting,
        expanded: isExpanded,
        protected: itemProtected,
        showRetry,
        retrying: isRetrying,
      }}
      toggleFiles={toggleFiles}
      activeType={activeType}
      onStopSeeding={handleStopSeeding}
      onForceStart={handleForceStart}
      onRetry={handleRetry}
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
      actionVisibility={{
        download: compact && !mobileBar && item.download_present,
        delete: compact || mobileBar,
        archive: showArchive,
        protection: showProtection,
        retry: showRetry,
        airlock: showAirlock,
      }}
      actionProgress={{
        deleting: isDeleting,
        archiving: isArchiving,
        retrying: isRetrying,
        protectionUpdating: isUpdatingProtection,
        airlockUpdating: isAirlockUpdating,
      }}
      itemFlags={{ protected: itemProtected, airlocked: itemAirlocked }}
      onDownload={handleDownload}
      onDelete={handleDelete}
      onArchive={handleArchive}
      onToggleProtection={handleToggleProtection}
      onRetry={handleRetry}
      onToggleAirlock={handleToggleAirlock}
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

export default memo(ItemActions);
