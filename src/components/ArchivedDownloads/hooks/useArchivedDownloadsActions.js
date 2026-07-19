import { useState, useCallback } from 'react';

export function useArchivedDownloadsActions(
  apiKey,
  fetchArchivedDownloads,
  setSelectedItems,
  removeFromArchive,
  confirmAction,
  showAlert
) {
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleBulkDelete = useCallback(
    async (selectedItems) => {
      if (selectedItems.size === 0) return;

      const count = selectedItems.size;
      if (
        !(await confirmAction(
          `Delete ${count} archived download entr${count > 1 ? 'ies' : 'y'}? This cannot be undone.`,
          { confirmLabel: 'Delete' }
        ))
      ) {
        return;
      }

      try {
        setBulkDeleting(true);

        const ids = Array.from(selectedItems)
          .map((id) => {
            const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
            return isNaN(numId) || numId <= 0 ? null : numId;
          })
          .filter((id) => id !== null);

        if (ids.length === 0) {
          showAlert('No valid archive IDs to delete');
          return;
        }

        const response = await fetch('/api/archived-downloads/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ ids }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete archived downloads');
        }

        setSelectedItems(new Set());
        await fetchArchivedDownloads();
      } catch (err) {
        console.error('Error bulk deleting archived downloads:', err);
        showAlert(err.message);
      } finally {
        setBulkDeleting(false);
      }
    },
    [apiKey, fetchArchivedDownloads, setSelectedItems, confirmAction, showAlert]
  );

  const handleRemove = useCallback(
    async (torrentId, onSuccess, onError) => {
      try {
        await removeFromArchive(torrentId);
        onSuccess?.();
      } catch (err) {
        onError?.(err);
      }
    },
    [removeFromArchive]
  );

  return {
    bulkDeleting,
    handleBulkDelete,
    handleRemove,
  };
}
