'use client';

import { useState } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { useTranslations } from 'next-intl';
import { deleteItemHelper, batchDeleteHelper, deleteEntryFromItem } from '@/utils/deleteHelpers';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { isQueuedItem } from '@/utils/utility';
import { useDestructiveActionGuard } from '@/components/downloads/hooks/useDestructiveActionGuard';

const EMPTY_DELETE_PROGRESS = { current: 0, total: 0 };

export function useDelete(apiKey, setSelectedItems, setToast, _fetchItems, assetType = 'torrents') {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState(EMPTY_DELETE_PROGRESS);
  const t = useTranslations('ItemActions.toast');
  const { partition, toastAllBlocked, skipSuffix, mapProtectedError, guardSingle } =
    useDestructiveActionGuard(setToast);

  const setIsDeletingRef = useLatestRef(setIsDeleting);
  const setDeleteProgressRef = useLatestRef(setDeleteProgress);

  const applyLocalRemovals = (successfulIds, itemsForGrouping = []) => {
    const store = useTorboxDownloadsStore.getState();

    if (assetType === 'all' && itemsForGrouping.length > 0) {
      const grouped = { torrents: [], usenet: [], webdl: [] };
      const idSet = new Set(successfulIds);

      itemsForGrouping.forEach((item) => {
        if (!idSet.has(item.id)) return;
        const type = item.assetType || 'torrents';
        if (grouped[type]) grouped[type].push(item.id);
      });

      for (const [type, ids] of Object.entries(grouped)) {
        if (ids.length > 0) store.removeByIds(type, ids);
      }
    } else {
      const type = assetType === 'usenet' ? 'usenet' : assetType === 'webdl' ? 'webdl' : 'torrents';
      store.removeByIds(type, successfulIds);
    }
  };

  const removeItemFromSelection = (item) => {
    const selectionId = getDownloadSelectionId(item);
    setSelectedItems((prev) => ({
      items: new Set([...prev.items].filter((id) => id !== selectionId)),
      files: new Map([...prev.files].filter(([id]) => id !== selectionId)),
    }));
  };

  const deleteItem = async (id, bulk = false, itemAssetType = null, item = null) => {
    if (!apiKey) return;

    if (item && !guardSingle(item)) {
      return { success: false, protected: true };
    }

    try {
      setIsDeletingRef.current(true);
      const actualAssetType = assetType === 'all' && itemAssetType ? itemAssetType : assetType;
      const result = await deleteItemHelper(id, apiKey, actualAssetType, {
        queued: isQueuedItem(item),
      });

      if (result.success) {
        if (!bulk) {
          if (assetType === 'all' && itemAssetType) {
            useTorboxDownloadsStore.getState().removeByIds(itemAssetType, [id]);
          } else {
            applyLocalRemovals([id]);
          }
        }

        setToast({
          message: t('deleteSuccess'),
          type: 'success',
        });

        return { success: true };
      }

      throw new Error(result.error);
    } catch (error) {
      console.error('Error deleting:', error);
      const message = mapProtectedError(error) || t('deleteError', { error: error.message });
      setToast({
        message,
        type: 'error',
      });
      return { success: false, error: error.message };
    } finally {
      setIsDeletingRef.current(false);
    }
  };

  const batchDelete = async (ids, items = []) => {
    try {
      const { allowed, blocked } = partition(items);
      const allowedIds = allowed.map((item) => item.id);
      const skippedCount = blocked.length;

      if (allowedIds.length === 0) {
        toastAllBlocked();
        return [];
      }

      setDeleteProgressRef.current({ current: 0, total: allowedIds.length });

      const itemById = new Map(allowed.map((item) => [item.id, item]));
      const onItemComplete = ({ id, success }) => {
        if (!success) return;

        const item = itemById.get(id);
        if (item) {
          applyLocalRemovals([id], [item]);
          removeItemFromSelection(item);
        }

        setDeleteProgressRef.current((prev) => ({
          ...prev,
          current: Math.min(prev.current + 1, prev.total),
        }));
      };

      let successfulIds = [];

      if (assetType === 'all' && allowed.length > 0) {
        const groupedItems = {
          torrents: [],
          usenet: [],
          webdl: [],
        };

        allowed.forEach((item) => {
          const itemAssetType = item.assetType || 'torrents';
          const entry = deleteEntryFromItem(item);
          if (groupedItems[itemAssetType] && entry) {
            groupedItems[itemAssetType].push(entry);
          }
        });

        for (const [type, typeEntries] of Object.entries(groupedItems)) {
          if (typeEntries.length === 0) continue;
          const batchIds = await batchDeleteHelper(typeEntries, apiKey, type, { onItemComplete });
          successfulIds.push(...batchIds);
        }
      } else {
        const entries = allowed.map((item) => deleteEntryFromItem(item)).filter(Boolean);
        successfulIds = await batchDeleteHelper(entries, apiKey, assetType, { onItemComplete });
      }

      const totalRequested = ids.length;
      if (successfulIds.length === totalRequested) {
        setToast({
          message: t('deleteAllSuccess'),
          type: 'success',
        });
      } else if (successfulIds.length > 0) {
        setToast({
          message: `${t('deletePartialSuccess', {
            count: successfulIds.length,
            total: totalRequested,
          })}${skipSuffix(skippedCount)}`,
          type: 'warning',
        });
      } else {
        setToast({
          message: skippedCount > 0 ? t('protectedBlocked') : t('deleteAllFailed'),
          type: 'error',
        });
      }

      return successfulIds;
    } catch (error) {
      console.error('Error in batch delete:', error);
      setToast({
        message: t('deleteError', { error: error.message }),
        type: 'error',
      });
      return [];
    } finally {
      setDeleteProgressRef.current(EMPTY_DELETE_PROGRESS);
    }
  };

  const deleteItems = async (selectedItems, deleteParentDownloads = false, allItems = []) => {
    if (!apiKey || (selectedItems.items.size === 0 && selectedItems.files.size === 0)) return;

    try {
      setIsDeletingRef.current(true);

      const itemsToDelete = new Set(selectedItems.items);

      if (deleteParentDownloads && selectedItems.files.size > 0) {
        selectedItems.files.forEach((_, parentSelectionId) => {
          itemsToDelete.add(parentSelectionId);
        });
      }

      const itemsToDeleteList = allItems.filter((item) =>
        itemsToDelete.has(getDownloadSelectionId(item))
      );

      const numericIds = itemsToDeleteList.map((item) => item.id);

      return await batchDelete(numericIds, itemsToDeleteList);
    } catch (error) {
      console.error('Error bulk deleting:', error);
      setToast({
        message: t('deleteError', { error: error.message }),
        type: 'error',
      });
      return [];
    } finally {
      setIsDeletingRef.current(false);
    }
  };

  return {
    isDeleting,
    deleteProgress,
    deleteItem,
    deleteItems,
  };
}
