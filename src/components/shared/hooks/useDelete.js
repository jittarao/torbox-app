'use client';

import { useState } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';

const CONCURRENT_DELETES = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

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

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete: ${response.statusText}`);
      }

      // Refresh the list after deletion
      if (!bulk) {
        await fetchItems(true);
      }

      setToast({
        message: 'Successfully deleted',
        type: 'success',
      });

      return { success: true };
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
            // Try delete with retries
            let retries = 0;
            while (retries < MAX_RETRIES) {
              const result = await deleteItem(id, true);

              if (result.success) {
                successfulIds.push(id);
                return { id, success: true };
              }

              // Check for non-retryable errors
              if (Object.values(NON_RETRYABLE_ERRORS).includes(result.error)) {
                console.error(`Delete failed for item ${id}: ${result.error}`);
                return { id, success: false, error: result.error };
              }

              retries++;
              if (retries < MAX_RETRIES) {
                await new Promise((resolve) =>
                  setTimeout(resolve, RETRY_DELAY),
                );
              }
            }

            // Max retries reached - log and continue
            return { id, success: false, error: 'Max retries reached' };
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
