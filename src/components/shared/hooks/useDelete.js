'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { deleteItemHelper, batchDeleteHelper } from '@/utils/deleteHelpers';

// Parallel deletes
const CONCURRENT_DELETES = 3;

export function useDelete(
  apiKey,
  setItems,
  setSelectedItems,
  setToast,
  fetchItems,
  assetType = 'torrents',
) {
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('ItemActions.toast');

  const deleteItem = async (id, bulk = false, itemAssetType = null) => {
    if (!apiKey) return;

    try {
      setIsDeleting(true);
      // For 'all' type, determine the actual asset type from the item
      const actualAssetType = assetType === 'all' && itemAssetType ? itemAssetType : assetType;
      const result = await deleteItemHelper(id, apiKey, actualAssetType);

      if (result.success) {
        // Refresh the list after deletion
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
      
      // For 'all' type, we need to group items by their asset type and delete them separately
      if (assetType === 'all' && items.length > 0) {
        const groupedItems = {
          torrents: [],
          usenet: [],
          webdl: []
        };
        
        // Group items by their asset type
        items.forEach(item => {
          const itemAssetType = item.assetType || 'torrents';
          if (groupedItems[itemAssetType]) {
            groupedItems[itemAssetType].push(item.id);
          }
        });
        
        // Delete each group separately
        for (const [type, typeIds] of Object.entries(groupedItems)) {
          if (typeIds.length > 0) {
            const typeSuccessfulIds = await batchDeleteHelper(typeIds, apiKey, type);
            successfulIds.push(...typeSuccessfulIds);
          }
        }
      } else {
        successfulIds = await batchDeleteHelper(ids, apiKey, assetType);
      }

      // Update UI for successful deletes
      if (successfulIds.length > 0) {
        setItems((prev) => prev.filter((t) => !successfulIds.includes(t.id)));
        setSelectedItems((prev) => ({
          items: new Set(
            [...prev.items].filter((id) => !successfulIds.includes(id)),
          ),
          files: new Map(
            [...prev.files].filter(
              ([itemId]) => !successfulIds.includes(itemId),
            ),
          ),
        }));
      }

      // Show appropriate toast based on results
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

      // Fetch fresh data only after all deletes are complete
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
    if (
      !apiKey ||
      (selectedItems.items.size === 0 && selectedItems.files.size === 0)
    )
      return;

    try {
      setIsDeleting(true);

      // Start with explicitly selected items
      const itemsToDelete = new Set(selectedItems.items);

      // If deleteParentDownloads is true, add parent download IDs to the deletion set
      if (deleteParentDownloads && selectedItems.files.size > 0) {
        selectedItems.files.forEach((_, parentId) => {
          itemsToDelete.add(parentId);
        });
      }

      // Filter the items to only include the ones being deleted
      const itemsToDeleteList = allItems.filter(item => itemsToDelete.has(item.id));

      return await batchDelete(Array.from(itemsToDelete), itemsToDeleteList);
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
