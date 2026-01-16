import { useState, useCallback } from 'react';

export function useLinkHistoryActions(apiKey, fetchLinkHistory, setSelectedLinks) {
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleDelete = useCallback(
    async (id) => {
      if (!confirm('Are you sure you want to delete this link history entry?')) {
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
    [apiKey, fetchLinkHistory]
  );

  const handleBulkDelete = useCallback(
    async (selectedLinks) => {
      if (selectedLinks.size === 0) return;

      const count = selectedLinks.size;
      if (!confirm(`Delete ${count} link history entr${count > 1 ? 'ies' : 'y'}?`)) {
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
    [apiKey, fetchLinkHistory, setSelectedLinks]
  );

  const handleCopy = useCallback(async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  }, []);

  return {
    deleting,
    bulkDeleting,
    copySuccess,
    handleDelete,
    handleBulkDelete,
    handleCopy,
  };
}
