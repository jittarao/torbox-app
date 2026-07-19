import { useState, useCallback } from 'react';

export function useLinkHistoryActions(apiKey, fetchLinkHistory, setSelectedLinks, confirmAction) {
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [copiedLinkCount, setCopiedLinkCount] = useState(0);

  const handleDelete = useCallback(
    async (id) => {
      if (
        !(await confirmAction('Are you sure you want to delete this link history entry?', {
          confirmLabel: 'Delete',
        }))
      ) {
        return;
      }

      try {
        setDeleting(true);

        const response = await fetch(`/api/link-history/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete link history entry');
        }

        await fetchLinkHistory();
      } catch (err) {
        console.error('Error deleting link history entry:', err);
        alert(err.message);
      } finally {
        setDeleting(false);
      }
    },
    [apiKey, fetchLinkHistory, confirmAction]
  );

  const handleBulkDelete = useCallback(
    async (selectedLinks) => {
      if (selectedLinks.size === 0) return;

      const count = selectedLinks.size;
      if (
        !(await confirmAction(`Delete ${count} link history entr${count > 1 ? 'ies' : 'y'}?`, {
          confirmLabel: 'Delete',
        }))
      ) {
        return;
      }

      try {
        setBulkDeleting(true);

        const ids = Array.from(selectedLinks)
          .map((id) => {
            const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
            return isNaN(numId) || numId <= 0 ? null : numId;
          })
          .filter((id) => id !== null);

        if (ids.length === 0) {
          alert('No valid link history IDs to delete');
          return;
        }

        const response = await fetch('/api/link-history/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ ids }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete link history entries');
        }

        setSelectedLinks(new Set());
        await fetchLinkHistory();
      } catch (err) {
        console.error('Error bulk deleting link history:', err);
        alert(err.message);
      } finally {
        setBulkDeleting(false);
      }
    },
    [apiKey, fetchLinkHistory, setSelectedLinks, confirmAction]
  );

  const showCopySuccess = useCallback((count) => {
    setCopiedLinkCount(count);
    setCopySuccess(true);
    setTimeout(() => {
      setCopySuccess(false);
      setCopiedLinkCount(0);
    }, 2000);
  }, []);

  const handleCopy = useCallback(
    async (url) => {
      try {
        await navigator.clipboard.writeText(url);
        showCopySuccess(1);
      } catch (err) {
        console.error('Failed to copy:', err);
        alert('Failed to copy to clipboard');
      }
    },
    [showCopySuccess]
  );

  const handleBulkCopy = useCallback(
    async (selectedItems) => {
      const copyable = selectedItems.filter((item) => item.status !== 'failed' && item.url);
      if (copyable.length === 0) return;

      const text = copyable.map((item) => item.url).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        showCopySuccess(copyable.length);
      } catch (err) {
        console.error('Failed to copy links:', err);
        alert('Failed to copy to clipboard');
      }
    },
    [showCopySuccess]
  );

  return {
    deleting,
    bulkDeleting,
    copySuccess,
    copiedLinkCount,
    handleDelete,
    handleBulkDelete,
    handleCopy,
    handleBulkCopy,
  };
}
