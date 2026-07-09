'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { deleteItemHelper, batchDeleteHelper } from '@/utils/deleteHelpers';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { useDestructiveActionGuard } from '@/components/downloads/hooks/useDestructiveActionGuard';

export function useDelete(apiKey, setSelectedItems, setToast, _fetchItems, assetType = 'torrents') {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('ItemActions.toast');
  const { partition, toastAllBlocked, skipSuffix, mapProtectedError, guardSingle } =
    useDestructiveActionGuard(setToast);

  const setIsDeletingRef = useRef(setIsDeleting);
  setIsDeletingRef.current = setIsDeleting;

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

  const deleteItem = async (id, bulk = false, itemAssetType = null, item = null) => {
    if (!apiKey) return;

    if (item && !guardSingle(item)) {
      return { success: false, protected: true };
    }

    try {
      setIsDeletingRef.current(true);
      const actualAssetType = assetType === 'all' && itemAssetType ? itemAssetType : assetType;
      const result = await deleteItemHelper(id, apiKey, actualAssetType);

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

      let successfulIds = [];

      if (assetType === 'all' && allowed.length > 0) {
        const groupedItems = {
          torrents: [],
          usenet: [],
          webdl: [],
        };

        allowed.forEach((item) => {
          const itemAssetType = item.assetType || 'torrents';
          if (groupedItems[itemAssetType]) {
            groupedItems[itemAssetType].push(item.id);
          }
        });

        const results = await Promise.all(
          Object.entries(groupedItems).flatMap(([type, typeIds]) =>
            typeIds.length > 0 ? [batchDeleteHelper(typeIds, apiKey, type)] : []
          )
        );
        for (const batchIds of results) {
          successfulIds.push(...batchIds);
        }
      } else {
        successfulIds = await batchDeleteHelper(allowedIds, apiKey, assetType);
      }

      if (successfulIds.length > 0) {
        applyLocalRemovals(successfulIds, allowed);

        const removedSelectionIds = new Set(
          allowed
            .filter((item) => successfulIds.includes(item.id))
            .map((item) => getDownloadSelectionId(item))
        );

        setSelectedItems((prev) => ({
          items: new Set([...prev.items].filter((id) => !removedSelectionIds.has(id))),
          files: new Map(
            [...prev.files].filter(([selectionId]) => !removedSelectionIds.has(selectionId))
          ),
        }));
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
    deleteItem,
    deleteItems,
  };
}
