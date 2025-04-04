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

  const deleteItem = async (id, bulk = false) => {
    if (!apiKey) return;

    try {
      setIsDeleting(true);
      const result = await deleteItemHelper(id, apiKey, assetType);

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

  const batchDelete = async (ids) => {
    try {
      const successfulIds = await batchDeleteHelper(ids, apiKey, assetType);

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

  const deleteItems = async (selectedItems, deleteParentDownloads = false) => {
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

      return await batchDelete(Array.from(itemsToDelete));
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
