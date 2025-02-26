'use client';

import { useState } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';

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

  const getDeleteEndpoint = () => {
    switch (assetType) {
      case 'usenet':
        return '/api/usenet';
      case 'webdl':
        return '/api/webdl';
      default:
        return '/api/torrents';
    }
  };

  const deleteItem = async (id, bulk = false) => {
    if (!apiKey) return;

    try {
      setIsDeleting(true);
      const endpoint = getDeleteEndpoint();

      const result = await retryFetch(endpoint, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: { id },
        permanent: [
          (data) =>
            Object.values(NON_RETRYABLE_ERRORS).some(
              (err) => data.error?.includes(err) || data.detail?.includes(err),
            ),
        ],
      });

      if (result.success) {
        // Refresh the list after deletion
        if (!bulk) {
          await fetchItems(true);
        }

        setToast({
          message: 'Successfully deleted',
          type: 'success',
        });

        return { success: true };
      }

      throw new Error(result.error);
    } catch (error) {
      console.error('Error deleting:', error);
      setToast({
        message: `Error deleting: ${error.message}`,
        type: 'error',
      });
      return { success: false, error: error.message };
    } finally {
      setIsDeleting(false);
    }
  };

  const batchDelete = async (ids) => {
    const successfulIds = [];
    setIsDeleting(true);

    try {
      // Process in chunks
      for (let i = 0; i < ids.length; i += CONCURRENT_DELETES) {
        const chunk = ids.slice(i, i + CONCURRENT_DELETES);
        const results = await Promise.all(
          chunk.map(async (id) => {
            const result = await deleteItem(id, true);
            if (result.success) {
              successfulIds.push(id);
            }
            return { id, ...result };
          }),
        );

        // Update UI for successful deletes in this chunk
        const chunkSuccessIds = results
          .filter((result) => result.success)
          .map((result) => result.id);

        if (chunkSuccessIds.length > 0) {
          setItems((prev) =>
            prev.filter((t) => !chunkSuccessIds.includes(t.id)),
          );
          setSelectedItems((prev) => ({
            items: new Set(
              [...prev.items].filter((id) => !chunkSuccessIds.includes(id)),
            ),
            files: new Map(
              [...prev.files].filter(
                ([itemId]) => !chunkSuccessIds.includes(itemId),
              ),
            ),
          }));
        }
      }

      // Show appropriate toast based on results
      if (successfulIds.length === ids.length) {
        setToast({
          message: 'All items successfully deleted',
          type: 'success',
        });
      } else if (successfulIds.length > 0) {
        setToast({
          message: `Deleted ${successfulIds.length} of ${ids.length} items`,
          type: 'warning',
        });
      } else {
        setToast({
          message: 'Failed to delete items',
          type: 'error',
        });
      }

      // Fetch fresh data only after all deletes are complete
      await fetchItems(true);

      return successfulIds;
    } catch (error) {
      console.error('Error in batch delete:', error);
      setToast({
        message: `Error deleting: ${error.message}`,
        type: 'error',
      });
      return [];
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteItems = async (selectedItems) => {
    if (!apiKey || selectedItems.items.size === 0) return;

    try {
      return await batchDelete(Array.from(selectedItems.items));
    } catch (error) {
      console.error('Error bulk deleting:', error);
      setToast({
        message: `Error deleting: ${error.message}`,
        type: 'error',
      });
      return [];
    }
  };

  return {
    isDeleting,
    deleteItem,
    deleteItems,
  };
}
