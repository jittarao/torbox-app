import { useState } from 'react';
import { phEvent } from '@/utils/sa';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { retryDownload } from '@/utils/retryDownload';
import { controlQueuedItem } from '@/utils/uploadActions';
import { removeQueuedAfterForceStartBulk } from '@/store/downloadListReconcile';
import { performBulkAirlock } from './performBulkAirlock';

export function useActionButtonsHandlers({
  apiKey,
  activeType,
  selection,
  patchItem,
  setToast,
  t,
  tItemActions,
  stopSeedingItems,
  isStoppingSeeding,
  protectItems,
  unprotectItems,
  isUpdatingProtection,
  bulkAirlockPendingAction,
  setBulkAirlockPendingAction,
}) {
  const [isForceStarting, setIsForceStarting] = useState(false);
  const [isBulkRetrying, setIsBulkRetrying] = useState(false);

  const handleBulkStopSeeding = async () => {
    if (isStoppingSeeding || !apiKey || selection.selectedSeedingTorrents.length === 0) return;
    await stopSeedingItems(selection.selectedSeedingTorrents);
    phEvent('bulk_stop_seeding', { count: selection.selectedSeedingTorrents.length });
  };

  const handleBulkProtect = async () => {
    if (isUpdatingProtection || selection.selectedUnprotectedItems.length === 0) return;
    await protectItems(selection.selectedUnprotectedItems);
  };

  const handleBulkUnprotect = async () => {
    if (isUpdatingProtection || selection.selectedProtectedItems.length === 0) return;
    await unprotectItems(selection.selectedProtectedItems);
  };

  const handleBulkRetry = async () => {
    if (isBulkRetrying || !apiKey || selection.selectedRetryable.length === 0) return;

    setIsBulkRetrying(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const results = await Promise.all(
        selection.selectedRetryable.map((item) => retryDownload(apiKey, item, activeType))
      );
      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({
          message: t('bulkRetryStarted', { count: successCount }),
          type: 'success',
        });
        phEvent('bulk_retry_downloads', { count: successCount });
      } else if (successCount > 0) {
        setToast({
          message: t('bulkRetryPartial', { success: successCount, failed: failCount }),
          type: 'warning',
        });
        phEvent('bulk_retry_downloads', { count: successCount, failed: failCount });
      } else {
        setToast({
          message: tItemActions('retryFailed'),
          type: 'error',
        });
      }
    } catch (error) {
      console.error('Error in bulk retry:', error);
      setToast({
        message: tItemActions('retryFailed'),
        type: 'error',
      });
    } finally {
      setIsBulkRetrying(false);
    }
  };

  const handleBulkAirlock = async (nextAirlocked) => {
    if (
      bulkAirlockPendingAction !== null ||
      !apiKey ||
      selection.selectedAirlockableItems.length === 0
    )
      return;

    setBulkAirlockPendingAction(nextAirlocked ? 'lock' : 'unlock');

    try {
      await performBulkAirlock({
        apiKey,
        activeType,
        selectedAirlockableItems: selection.selectedAirlockableItems,
        nextAirlocked,
        patchItem,
        setToast,
        t,
      });
    } finally {
      setBulkAirlockPendingAction(null);
    }
  };

  const handleBulkForceStart = async () => {
    if (isForceStarting || !apiKey || selection.selectedQueuedTorrents.length === 0) return;

    setIsForceStarting(true);
    let successCount = 0;
    let failCount = 0;

    const removedByType = { torrents: [], usenet: [], webdl: [] };

    try {
      const results = await Promise.all(
        selection.selectedQueuedTorrents.map((item) => {
          const assetType = resolveItemAssetType(item, activeType);
          return controlQueuedItem(apiKey, item.id, 'start', assetType).then((result) => ({
            item,
            assetType,
            result,
          }));
        })
      );
      for (const { item, assetType, result } of results) {
        if (result?.success) {
          successCount++;
          removedByType[assetType].push(item.id);
        } else {
          failCount++;
        }
      }

      if (successCount > 0 && failCount === 0) {
        setToast({
          message: t('bulkForceStarted', { count: successCount }),
          type: 'success',
        });
        phEvent('bulk_force_start', { count: successCount });
      } else if (successCount > 0) {
        setToast({
          message: t('bulkForceStartPartial', { success: successCount, failed: failCount }),
          type: 'warning',
        });
        phEvent('bulk_force_start', { count: successCount, failed: failCount });
      } else {
        setToast({
          message: tItemActions('downloadFailed'),
          type: 'error',
        });
      }

      if (successCount > 0) {
        removeQueuedAfterForceStartBulk(removedByType);
      }
    } catch (error) {
      console.error('Error in bulk force start:', error);
      setToast({
        message: tItemActions('downloadFailed'),
        type: 'error',
      });
    } finally {
      setIsForceStarting(false);
    }
  };

  return {
    isForceStarting,
    isBulkRetrying,
    handleBulkStopSeeding,
    handleBulkProtect,
    handleBulkUnprotect,
    handleBulkRetry,
    handleBulkAirlock,
    handleBulkForceStart,
  };
}
