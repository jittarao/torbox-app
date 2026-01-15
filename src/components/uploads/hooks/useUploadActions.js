import { useState, useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

export function useUploadActions(apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads) {
  const [retrying, setRetrying] = useState(new Set());
  const [deleting, setDeleting] = useState(new Set());
  const [downloading, setDownloading] = useState(new Set());
  const [copying, setCopying] = useState(new Set());
  const [reordering, setReordering] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);

  const handleRetry = useCallback(
    async (id) => {
      if (retrying.has(id)) return;

      try {
        setRetrying((prev) => new Set(prev).add(id));

        const response = await fetch(`/api/uploads/${id}/retry`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to retry upload');
        }

        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error retrying upload:', err);
        alert(err.message);
      } finally {
        setRetrying((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [apiKey, retrying, fetchUploads, fetchStatusCounts]
  );

  const handleDelete = useCallback(
    async (id) => {
      if (deleting.has(id) || !confirm('Are you sure you want to delete this upload?')) return;

      try {
        setDeleting((prev) => new Set(prev).add(id));

        const response = await fetch(`/api/uploads/${id}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': apiKey,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete upload');
        }

        setSelectedUploads((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error deleting upload:', err);
        alert(err.message);
      } finally {
        setDeleting((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [apiKey, deleting, fetchUploads, fetchStatusCounts, setSelectedUploads]
  );

  const handleDownload = useCallback(
    async (id) => {
      if (downloading.has(id)) return;

      try {
        setDownloading((prev) => new Set(prev).add(id));

        const response = await fetch(`/api/uploads/${id}/download`, {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to download file');
        }

        // Get filename from Content-Disposition header or use a default
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'download';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
          if (filenameMatch) {
            filename = filenameMatch[1];
          }
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (err) {
        console.error('Error downloading file:', err);
        alert(err.message);
      } finally {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [apiKey, downloading]
  );

  const handleCopy = useCallback(
    async (url, id) => {
      if (copying.has(id)) return;

      try {
        setCopying((prev) => new Set(prev).add(id));

        await navigator.clipboard.writeText(url);
        setCopySuccess(id);
        setTimeout(() => setCopySuccess(null), 2000);
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        alert('Failed to copy to clipboard');
      } finally {
        setCopying((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [copying]
  );

  const handleBulkDelete = useCallback(
    async (selectedUploads) => {
      if (selectedUploads.size === 0) return;

      const count = selectedUploads.size;
      if (
        !confirm(
          `Are you sure you want to delete ${count} upload${count > 1 ? 's' : ''}? This action cannot be undone.`
        )
      ) {
        return;
      }

      try {
        setBulkDeleting(true);

        const ids = Array.from(selectedUploads)
          .map((id) => {
            const numId = typeof id === 'string' ? parseInt(id, 10) : Number(id);
            return isNaN(numId) || numId <= 0 ? null : numId;
          })
          .filter((id) => id !== null);

        if (ids.length === 0) {
          alert('No valid upload IDs selected');
          return;
        }

        const response = await fetch('/api/uploads/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ ids }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete uploads');
        }

        setSelectedUploads(new Set());
        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error bulk deleting uploads:', err);
        alert(err.message);
      } finally {
        setBulkDeleting(false);
      }
    },
    [apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads]
  );

  const handleBulkRetry = useCallback(
    async (selectedUploads, uploads) => {
      if (selectedUploads.size === 0) return;

      const failedUploads = uploads.filter(
        (u) => selectedUploads.has(u.id) && u.status === 'failed'
      );

      if (failedUploads.length === 0) {
        alert('No failed uploads selected. Only failed uploads can be retried.');
        return;
      }

      const count = failedUploads.length;
      if (
        !confirm(
          `Retry ${count} failed upload${count > 1 ? 's' : ''}? They will be added back to the queue.`
        )
      ) {
        return;
      }

      try {
        setBulkRetrying(true);

        const ids = failedUploads
          .map((u) => {
            const numId = typeof u.id === 'string' ? parseInt(u.id, 10) : Number(u.id);
            return isNaN(numId) || numId <= 0 ? null : numId;
          })
          .filter((id) => id !== null);

        if (ids.length === 0) {
          alert('No valid upload IDs to retry');
          return;
        }

        const response = await fetch('/api/uploads/bulk/retry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ ids }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to retry uploads');
        }

        setSelectedUploads(new Set());
        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error bulk retrying uploads:', err);
        alert(err.message);
      } finally {
        setBulkRetrying(false);
      }
    },
    [apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads]
  );

  const handleDragEnd = useCallback(
    async (event, uploads, setUploads) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const queuedUploads = uploads
        .filter((u) => u.status === 'queued')
        .sort((a, b) => {
          return (a.queue_order ?? 0) - (b.queue_order ?? 0);
        });
      const oldIndex = queuedUploads.findIndex((u) => u.id === active.id);
      const newIndex = queuedUploads.findIndex((u) => u.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const movedUpload = queuedUploads[oldIndex];
      const oldOrder = movedUpload.queue_order ?? oldIndex;

      let newOrder;
      if (newIndex > oldIndex) {
        newOrder = queuedUploads[newIndex].queue_order ?? newIndex;
      } else {
        newOrder = queuedUploads[newIndex].queue_order ?? newIndex;
      }

      const reordered = arrayMove(queuedUploads, oldIndex, newIndex);
      setUploads(reordered);

      try {
        setReordering(true);

        const response = await fetch('/api/uploads/reorder', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            id: movedUpload.id,
            old_order: oldOrder,
            new_order: newOrder,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to reorder uploads');
        }

        await fetchUploads();
      } catch (err) {
        console.error('Error reordering uploads:', err);
        await fetchUploads();
        alert(err.message);
      } finally {
        setReordering(false);
      }
    },
    [apiKey, fetchUploads]
  );

  return {
    retrying,
    deleting,
    downloading,
    copying,
    reordering,
    bulkDeleting,
    bulkRetrying,
    copySuccess,
    handleRetry,
    handleDelete,
    handleDownload,
    handleCopy,
    handleBulkDelete,
    handleBulkRetry,
    handleDragEnd,
  };
}
