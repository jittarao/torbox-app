'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteItemHelper, batchDeleteHelper } from '@/utils/deleteHelpers';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

export function useDelete(
  apiKey,
  setSelectedItems,
  setToast,
  fetchItems,
  assetType = 'torrents'
) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('ItemActions.toast');

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
      const type =
        assetType === 'usenet' ? 'usenet' : assetType === 'webdl' ? 'webdl' : 'torrents';
      store.removeByIds(type, successfulIds);
    }
  };

  const deleteItem = async (id, bulk = false, itemAssetType = null) => {
    if (!apiKey) return;

    try {
      setIsDeleting(true);
      const actualAssetType = assetType === 'all' && itemAssetType ? itemAssetType : assetType;
      const result = await deleteItemHelper(id, apiKey, actualAssetType);

      if (result.success) {
        if (!bulk) {
          await fetchItems(true);
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
      setToast({
        message: t('deleteError', { error: error.message }),
        type: 'error',
      });
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  };

  const batchDelete = async (ids, items = []) => {
    try {
      let successfulIds = [];

      if (assetType === 'all' && items.length > 0) {
        const groupedItems = {
          torrents: [],
          usenet: [],
          webdl: [],
        };

        items.forEach((item) => {
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
        successfulIds = await batchDeleteHelper(ids, apiKey, assetType);
      }

      if (successfulIds.length > 0) {
        applyLocalRemovals(successfulIds, items);

        const removedSelectionIds = new Set(
          items
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

      if (successfulIds.length === ids.length) {
        setToast({
          message: t('deleteAllSuccess'),
          type: 'success',
        });
      } else if (successfulIds.length > 0) {
        setToast({
          message: t('deletePartialSuccess', {
            count: successfulIds.length,
            total: ids.length,
          }),
          type: 'warning',
        });
      } else {
        setToast({
          message: t('deleteAllFailed'),
          type: 'error',
        });
      }

      await fetchItems(true);

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
      setIsDeleting(true);

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
      setIsDeleting(false);
    }
  };

  return {
    isDeleting,
    deleteItem,
    deleteItems,
  };
}
