import { useState, useCallback } from 'react';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { arrayMove } from '@dnd-kit/sortable';
import { normalizeUploadId } from '../utils';

function idsFromSelection(selectedUploads) {
  return Array.from(selectedUploads)
    .map((id) => normalizeUploadId(id))
    .filter((id) => id !== null);
}

export function useUploadActions(
  apiKey,
  fetchUploads,
  fetchStatusCounts,
  setSelectedUploads,
  confirmAction,
  showAlert
) {
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
      const uploadId = normalizeUploadId(id);
      if (uploadId == null || retrying.has(uploadId)) return;

      try {
        setRetrying((prev) => new Set(prev).add(uploadId));

        const response = await fetch(`/api/uploads/${uploadId}/retry`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
          },
        });

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to retry upload');
        }

        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error retrying upload:', err);
        showAlert(err.message);
      } finally {
        setRetrying((prev) => {
          const next = new Set(prev);
          next.delete(uploadId);
          return next;
        });
      }
    },
    [apiKey, retrying, fetchUploads, fetchStatusCounts, showAlert]
  );

  const handleDelete = useCallback(
    async (id) => {
      const uploadId = normalizeUploadId(id);
      if (uploadId == null || deleting.has(uploadId)) {
        return;
      }

      if (
        !(await confirmAction('Are you sure you want to delete this upload?', {
          confirmLabel: 'Delete',
        }))
      ) {
        return;
      }

      try {
        setDeleting((prev) => new Set(prev).add(uploadId));

        const response = await fetch(`/api/uploads/${uploadId}`, {
          method: 'DELETE',
          headers: {
            'x-api-key': apiKey,
          },
        });

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to delete upload');
        }

        setSelectedUploads((prev) => {
          const next = new Set(prev);
          next.delete(uploadId);
          return next;
        });

        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error deleting upload:', err);
        showAlert(err.message);
      } finally {
        setDeleting((prev) => {
          const next = new Set(prev);
          next.delete(uploadId);
          return next;
        });
      }
    },
    [
      apiKey,
      deleting,
      fetchUploads,
      fetchStatusCounts,
      setSelectedUploads,
      confirmAction,
      showAlert,
    ]
  );

  const handleDownload = useCallback(
    async (id) => {
      const uploadId = normalizeUploadId(id);
      if (uploadId == null || downloading.has(uploadId)) return;

      try {
        setDownloading((prev) => new Set(prev).add(uploadId));

        const response = await fetch(`/api/uploads/${uploadId}/download`, {
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
        showAlert(err.message);
      } finally {
        setDownloading((prev) => {
          const next = new Set(prev);
          next.delete(uploadId);
          return next;
        });
      }
    },
    [apiKey, downloading, showAlert]
  );

  const handleCopy = useCallback(
    async (url, id) => {
      const uploadId = normalizeUploadId(id);
      if (uploadId == null || copying.has(uploadId)) return;

      try {
        setCopying((prev) => new Set(prev).add(uploadId));

        await navigator.clipboard.writeText(url);
        setCopySuccess(uploadId);
        setTimeout(() => setCopySuccess(null), 2000);
      } catch (err) {
        console.error('Error copying to clipboard:', err);
        showAlert('Failed to copy to clipboard');
      } finally {
        setCopying((prev) => {
          const next = new Set(prev);
          next.delete(uploadId);
          return next;
        });
      }
    },
    [copying, showAlert]
  );

  const bulkDeleteIds = useCallback(
    async (ids, confirmMessage) => {
      if (ids.length === 0) {
        showAlert('No valid upload IDs to delete');
        return;
      }

      if (!(await confirmAction(confirmMessage, { confirmLabel: 'Delete' }))) {
        return;
      }

      try {
        setBulkDeleting(true);

        const response = await fetch('/api/uploads/bulk', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ ids }),
        });

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to delete uploads');
        }

        setSelectedUploads(new Set());
        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error bulk deleting uploads:', err);
        showAlert(err.message);
      } finally {
        setBulkDeleting(false);
      }
    },
    [apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads, confirmAction, showAlert]
  );

  const handleBulkDelete = useCallback(
    async (selectedUploads) => {
      if (selectedUploads.size === 0) return;

      const ids = idsFromSelection(selectedUploads);
      const count = ids.length;
      if (count === 0) {
        showAlert('No valid upload IDs selected');
        return;
      }

      await bulkDeleteIds(
        ids,
        `Are you sure you want to delete ${count} upload${count > 1 ? 's' : ''}? This action cannot be undone.`
      );
    },
    [bulkDeleteIds]
  );

  const handleClearAllFailed = useCallback(
    async (filters) => {
      try {
        const params = new URLSearchParams({
          status: 'failed',
          page: '1',
          limit: '1000',
        });
        if (filters?.type) params.append('type', filters.type);

        const response = await fetch(`/api/uploads?${params.toString()}`, {
          headers: {
            'x-api-key': apiKey,
          },
        });

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to fetch failed uploads');
        }

        const ids = (data.data || [])
          .map((upload) => normalizeUploadId(upload.id))
          .filter((id) => id !== null);

        if (ids.length === 0) {
          showAlert('No failed uploads to delete');
          return;
        }

        const total = data.pagination?.total ?? ids.length;
        let message = `Delete all ${ids.length} failed upload${ids.length > 1 ? 's' : ''}? This cannot be undone.`;
        if (total > ids.length) {
          message = `Delete ${ids.length} of ${total} failed uploads (maximum 1000 per action)? This cannot be undone.`;
        }

        await bulkDeleteIds(ids, message);
      } catch (err) {
        console.error('Error clearing failed uploads:', err);
        showAlert(err.message);
      }
    },
    [apiKey, bulkDeleteIds]
  );

  const handleBulkRetry = useCallback(
    async (selectedUploads, uploads) => {
      if (selectedUploads.size === 0) return;

      const failedUploads = uploads.filter((u) => {
        const uploadId = normalizeUploadId(u.id);
        return uploadId != null && selectedUploads.has(uploadId) && u.status === 'failed';
      });

      if (failedUploads.length === 0) {
        showAlert('No failed uploads selected. Only failed uploads can be retried.');
        return;
      }

      const count = failedUploads.length;
      if (
        !(await confirmAction(
          `Retry ${count} failed upload${count > 1 ? 's' : ''}? They will be added back to the queue.`,
          { confirmLabel: 'Retry', confirmVariant: 'primary' }
        ))
      ) {
        return;
      }

      try {
        setBulkRetrying(true);

        const ids = failedUploads.map((u) => normalizeUploadId(u.id)).filter((id) => id !== null);

        if (ids.length === 0) {
          showAlert('No valid upload IDs to retry');
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

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to retry uploads');
        }

        setSelectedUploads(new Set());
        await fetchUploads();
        await fetchStatusCounts();
      } catch (err) {
        console.error('Error bulk retrying uploads:', err);
        showAlert(err.message);
      } finally {
        setBulkRetrying(false);
      }
    },
    [apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads, confirmAction, showAlert]
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

        const {
          ok: responseOk,
          status: responseStatus,
          data,
        } = await readJsonFromResponse(response);

        if (!responseOk) {
          throw new Error(data.error || 'Failed to reorder uploads');
        }

        await fetchUploads();
      } catch (err) {
        console.error('Error reordering uploads:', err);
        await fetchUploads();
        showAlert(err.message);
      } finally {
        setReordering(false);
      }
    },
    [apiKey, fetchUploads, showAlert]
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
    handleClearAllFailed,
    handleDragEnd,
  };
}
