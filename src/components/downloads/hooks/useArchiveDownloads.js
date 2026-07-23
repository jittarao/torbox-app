'use client';

import { useState, useRef } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useTranslations } from 'next-intl';
import { archiveAndRemoveItem, batchArchiveAndRemove } from '@/utils/archiveHelpers';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { useDestructiveActionGuard } from '@/components/downloads/hooks/useDestructiveActionGuard';

export function useArchiveDownloads(apiKey, setSelectedItems, setToast, assetType = 'torrents') {
  const [isArchiving, setIsArchiving] = useState(false);
  const t = useTranslations('ItemActions.toast');
  const { partition, toastAllBlocked, skipSuffix, mapProtectedError, guardSingle } =
    useDestructiveActionGuard(setToast);

  const setIsArchivingRef = useLatestRef(setIsArchiving);

  const applyLocalRemovals = (successfulIds) => {
    if (successfulIds.length === 0) return;
    useTorboxDownloadsStore.getState().removeByIds('torrents', successfulIds);
  };

  const clearSelectionForItems = (items, successfulIds) => {
    const idSet = new Set(successfulIds.map(String));
    const removedSelectionIds = new Set(
      items.reduce((acc, item) => {
        if (idSet.has(String(item.id))) {
          acc.push(getDownloadSelectionId(item));
        }
        return acc;
      }, [])
    );

    setSelectedItems((prev) => ({
      items: new Set([...prev.items].filter((id) => !removedSelectionIds.has(id))),
      files: new Map(
        [...prev.files].filter(([selectionId]) => !removedSelectionIds.has(selectionId))
      ),
    }));
  };

  const archiveItem = async (item) => {
    if (!apiKey) return { success: false };

    if (!item?.hash) {
      setToast({
        message: t('archiveNoHash'),
        type: 'error',
      });
      return { success: false };
    }

    const itemAssetType = resolveItemAssetType(item, assetType);
    if (itemAssetType !== 'torrents') {
      return { success: false };
    }

    if (!guardSingle(item)) {
      return { success: false, protected: true };
    }

    try {
      setIsArchivingRef.current(true);
      const result = await archiveAndRemoveItem(item, apiKey);

      if (result.success) {
        applyLocalRemovals([item.id]);
        setToast({
          message: t('archiveSuccess'),
          type: 'success',
        });
        return { success: true };
      }

      throw new Error(result.error);
    } catch (error) {
      console.error('Error archiving:', error);
      const message = mapProtectedError(error) || t('archiveError', { error: error.message });
      setToast({
        message,
        type: 'error',
      });
      return { success: false, error: error.message };
    } finally {
      setIsArchivingRef.current(false);
    }
  };

  const archiveItems = async (selectedItems, allItems = []) => {
    if (!apiKey || selectedItems.items.size === 0) return [];

    try {
      setIsArchivingRef.current(true);

      const itemsToArchive = allItems.filter((item) =>
        selectedItems.items.has(getDownloadSelectionId(item))
      );

      const torrentItems = itemsToArchive.filter(
        (item) => resolveItemAssetType(item, assetType) === 'torrents' && item.hash
      );

      if (torrentItems.length === 0) {
        setToast({
          message: t('archiveNoHash'),
          type: 'error',
        });
        return [];
      }

      const { allowed, blocked } = partition(torrentItems);
      const skippedCount = blocked.length;

      if (allowed.length === 0) {
        toastAllBlocked();
        return [];
      }

      const {
        successfulIds,
        error,
        blockedIds = [],
      } = await batchArchiveAndRemove(allowed, apiKey);
      const totalSkipped = skippedCount + blockedIds.length;

      if (successfulIds.length > 0) {
        applyLocalRemovals(successfulIds);
        clearSelectionForItems(allowed, successfulIds);
      }

      if (successfulIds.length === torrentItems.length) {
        setToast({
          message: t('archiveAllSuccess'),
          type: 'success',
        });
      } else if (successfulIds.length > 0) {
        setToast({
          message: `${t('archivePartialSuccess', {
            count: successfulIds.length,
            total: torrentItems.length,
          })}${skipSuffix(totalSkipped)}`,
          type: 'warning',
        });
      } else {
        setToast({
          message:
            totalSkipped > 0
              ? t('protectedBlocked')
              : error
                ? t('archiveError', { error })
                : t('archiveAllFailed'),
          type: 'error',
        });
      }

      return successfulIds;
    } catch (error) {
      console.error('Error bulk archiving:', error);
      setToast({
        message: t('archiveError', { error: error.message }),
        type: 'error',
      });
      return [];
    } finally {
      setIsArchivingRef.current(false);
    }
  };

  return {
    isArchiving,
    archiveItem,
    archiveItems,
  };
}
