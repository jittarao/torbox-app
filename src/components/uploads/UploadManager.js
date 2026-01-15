'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import Spinner from '../shared/Spinner';

const STATUS_COLORS = {
  queued: 'bg-blue-500/20 text-blue-500 dark:bg-blue-400/20 dark:text-blue-400',
  processing: 'bg-yellow-500/20 text-yellow-500 dark:bg-yellow-400/20 dark:text-yellow-400',
  completed: 'bg-green-500/20 text-green-500 dark:bg-green-400/20 dark:text-green-400',
  failed: 'bg-red-500/20 text-red-500 dark:bg-red-400/20 dark:text-red-400',
};

const TYPE_LABELS = {
  torrent: 'Torrent',
  usenet: 'Usenet',
  webdl: 'WebDL',
};

// Format error messages for better user experience
const formatErrorMessage = (errorMessage) => {
  if (!errorMessage) return null;

  // File not found
  if (errorMessage.includes('File not found')) {
    return 'File not found. The upload file may have been deleted.';
  }

  // Missing required option
  if (
    errorMessage.includes('MISSING_REQUIRED_OPTION') ||
    errorMessage.includes('Missing required option')
  ) {
    return 'Missing required option. Please check upload settings.';
  }

  // Invalid option
  if (errorMessage.includes('INVALID_OPTION') || errorMessage.includes('Invalid option')) {
    return 'Invalid option. Please check upload settings.';
  }

  // File or magnet link required
  if (errorMessage.includes('You must provide either a file or magnet link')) {
    return 'Invalid upload: file or magnet link is required.';
  }

  // Return original message if no match
  return errorMessage;
};

const STATUS_TABS = ['queued', 'completed', 'failed'];

// Format date in local browser timezone with consistent formatting
// Backend stores dates in UTC (from SQLite CURRENT_TIMESTAMP), so we need to parse them as UTC
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    // SQLite returns dates as "YYYY-MM-DD HH:MM:SS" in UTC (without timezone indicator)
    // We need to explicitly treat them as UTC by appending 'Z' or using UTC parsing
    let date;
    if (typeof dateString === 'string') {
      // If it's already in ISO format with 'Z', use it directly
      if (dateString.includes('T') && dateString.includes('Z')) {
        date = new Date(dateString);
      } else if (dateString.includes('T')) {
        // ISO format without Z - assume UTC
        date = new Date(dateString + 'Z');
      } else {
        // SQLite format: "YYYY-MM-DD HH:MM:SS" - replace space with T and add Z for UTC
        const utcString = dateString.replace(' ', 'T') + 'Z';
        date = new Date(utcString);
      }
    } else {
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) return 'Invalid date';

    // Format with locale-specific options for consistent display in local timezone
    // toLocaleString automatically converts from UTC to local timezone
    // Use a more human-readable format: "Jan 15, 2026, 2:41:23 PM"
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return 'Invalid date';
  }
};

// Sortable row component for queued items
function SortableUploadRow({
  upload,
  onRetry,
  onDelete,
  onDownload,
  onCopy,
  retrying,
  deleting,
  downloading,
  copying,
  selected,
  onSelect,
  copySuccess,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: upload.id,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x ?? 0}px, ${transform.y ?? 0}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const canDownload = upload.upload_type === 'file' && upload.file_path;
  const canCopy = (upload.upload_type === 'magnet' || upload.upload_type === 'link') && upload.url;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark ${
        selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark w-12">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(upload.id, e.target.checked)}
          className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-primary-text/50 dark:text-primary-text-dark/50 hover:text-primary-text dark:hover:text-primary-text-dark"
            title="Drag to reorder"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="9" cy="12" r="1" />
              <circle cx="9" cy="5" r="1" />
              <circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="12" r="1" />
              <circle cx="15" cy="5" r="1" />
              <circle cx="15" cy="19" r="1" />
            </svg>
          </button>
          <div className="max-w-md truncate" title={upload.name}>
            {upload.name}
          </div>
        </div>
        {upload.error_message && (
          <div className="text-xs text-red-500 dark:text-red-400 mt-1" title={upload.error_message}>
            {formatErrorMessage(upload.error_message)}
          </div>
        )}
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        {TYPE_LABELS[upload.type] || upload.type}
      </td>
      <td className="p-3">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[upload.status] || STATUS_COLORS.queued}`}
        >
          {upload.status}
        </span>
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.created_at)}
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.last_processed_at)}
      </td>
      <td className="p-3">
        <div className="flex gap-2 items-center">
          {canDownload && (
            <button
              onClick={() => onDownload(upload.id)}
              disabled={downloading.has(upload.id)}
              className="p-1.5 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
              title="Download original file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {canCopy && (
            <button
              onClick={() => onCopy(upload.url, upload.id)}
              disabled={copying.has(upload.id)}
              className={`p-1.5 rounded transition-colors ${
                copySuccess === upload.id
                  ? 'text-green-500 dark:text-green-400 bg-green-500/20 dark:bg-green-400/20'
                  : 'text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
              }`}
              title={copySuccess === upload.id ? 'Copied!' : 'Copy link'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
          {upload.status === 'failed' && (
            <button
              onClick={() => onRetry(upload.id)}
              disabled={retrying.has(upload.id)}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {retrying.has(upload.id) ? 'Retrying...' : 'Retry'}
            </button>
          )}
          <button
            onClick={() => onDelete(upload.id)}
            disabled={deleting.has(upload.id)}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {deleting.has(upload.id) ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Regular row component for non-queued items
function UploadRow({
  upload,
  onRetry,
  onDelete,
  onDownload,
  onCopy,
  retrying,
  deleting,
  downloading,
  copying,
  selected,
  onSelect,
  copySuccess,
}) {
  const canDownload = upload.upload_type === 'file' && upload.file_path;
  const canCopy = (upload.upload_type === 'magnet' || upload.upload_type === 'link') && upload.url;

  return (
    <tr
      className={`border-b border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark ${
        selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark w-12">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(upload.id, e.target.checked)}
          className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        <div className="max-w-md truncate" title={upload.name}>
          {upload.name}
        </div>
        {upload.error_message && (
          <div className="text-xs text-red-500 dark:text-red-400 mt-1" title={upload.error_message}>
            {formatErrorMessage(upload.error_message)}
          </div>
        )}
      </td>
      <td className="p-3 text-sm text-primary-text dark:text-primary-text-dark">
        {TYPE_LABELS[upload.type] || upload.type}
      </td>
      <td className="p-3">
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[upload.status] || STATUS_COLORS.queued}`}
        >
          {upload.status}
        </span>
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.created_at)}
      </td>
      <td className="p-3 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {formatDate(upload.last_processed_at)}
      </td>
      <td className="p-3">
        <div className="flex gap-2 items-center">
          {canDownload && (
            <button
              onClick={() => onDownload(upload.id)}
              disabled={downloading.has(upload.id)}
              className="p-1.5 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
              title="Download original file"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
          {canCopy && (
            <button
              onClick={() => onCopy(upload.url, upload.id)}
              disabled={copying.has(upload.id)}
              className={`p-1.5 rounded transition-colors ${
                copySuccess === upload.id
                  ? 'text-green-500 dark:text-green-400 bg-green-500/20 dark:bg-green-400/20'
                  : 'text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
              }`}
              title={copySuccess === upload.id ? 'Copied!' : 'Copy link'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}
          {upload.status === 'failed' && (
            <button
              onClick={() => onRetry(upload.id)}
              disabled={retrying.has(upload.id)}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {retrying.has(upload.id) ? 'Retrying...' : 'Retry'}
            </button>
          )}
          <button
            onClick={() => onDelete(upload.id)}
            disabled={deleting.has(upload.id)}
            className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {deleting.has(upload.id) ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function UploadManager({ apiKey }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('queued');
  const [statusCounts, setStatusCounts] = useState({});
  const [uploadStatistics, setUploadStatistics] = useState(null);
  const [filters, setFilters] = useState({
    type: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [retrying, setRetrying] = useState(new Set());
  const [deleting, setDeleting] = useState(new Set());
  const [downloading, setDownloading] = useState(new Set());
  const [copying, setCopying] = useState(new Set());
  const [reordering, setReordering] = useState(false);
  const [selectedUploads, setSelectedUploads] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkRetrying, setBulkRetrying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchUploads = useCallback(async () => {
    if (!apiKey) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: activeTab,
      });
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/uploads?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch uploads');
      }

      setUploads(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        totalPages: data.pagination?.totalPages || 0,
      }));

      // Update status counts if provided
      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }

      // Update upload statistics if provided
      if (data.uploadStatistics) {
        setUploadStatistics(data.uploadStatistics);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching uploads:', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, pagination.page, pagination.limit, activeTab, filters.type]);

  // Fetch status counts separately when tab changes
  const fetchStatusCounts = useCallback(async () => {
    if (!apiKey) return;

    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);

      const response = await fetch(`/api/uploads?${params.toString()}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }

      if (data.uploadStatistics) {
        setUploadStatistics(data.uploadStatistics);
      }
    } catch (err) {
      console.error('Error fetching status counts:', err);
    }
  }, [apiKey, filters.type]);

  useEffect(() => {
    fetchUploads();
    fetchStatusCounts();
    // Auto-refresh every 1 minute
    const interval = setInterval(() => {
      fetchUploads();
      fetchStatusCounts();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchUploads, fetchStatusCounts]);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeTab]);

  const handleRetry = async (id) => {
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
  };

  const handleDelete = async (id) => {
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
  };

  const handleDownload = async (id) => {
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
  };

  const handleCopy = async (url, id) => {
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
  };

  const handleBulkDelete = async () => {
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
  };

  const handleBulkRetry = async () => {
    if (selectedUploads.size === 0) return;

    const failedUploads = uploads.filter((u) => selectedUploads.has(u.id) && u.status === 'failed');

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
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUploads(new Set(uploads.map((u) => u.id)));
    } else {
      setSelectedUploads(new Set());
    }
  };

  const handleSelectUpload = (id, checked) => {
    setSelectedUploads((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleDragEnd = async (event) => {
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
  };

  const allSelected = uploads.length > 0 && selectedUploads.size === uploads.length;
  const someSelected = selectedUploads.size > 0 && selectedUploads.size < uploads.length;

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const totalPages = pagination.totalPages;
    const currentPage = pagination.page;

    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, current page, and pages around current
      if (currentPage <= 3) {
        // Near the start
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const renderTable = (enableDnd = false) => {
    const RowComponent = enableDnd ? SortableUploadRow : UploadRow;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border dark:border-border-dark">
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = someSelected;
                    }
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
                />
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Name
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Type
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Status
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Created
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Last Processed
              </th>
              <th className="text-left p-3 text-sm font-medium text-primary-text/70 dark:text-primary-text-dark/70">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {enableDnd ? (
              <SortableContext
                items={uploads.map((u) => u.id)}
                strategy={verticalListSortingStrategy}
              >
                {uploads.map((upload) => (
                  <RowComponent
                    key={upload.id}
                    upload={upload}
                    onRetry={handleRetry}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    onCopy={handleCopy}
                    retrying={retrying}
                    deleting={deleting}
                    downloading={downloading}
                    copying={copying}
                    selected={selectedUploads.has(upload.id)}
                    onSelect={handleSelectUpload}
                    apiKey={apiKey}
                    copySuccess={copySuccess}
                  />
                ))}
              </SortableContext>
            ) : (
              uploads.map((upload) => (
                <RowComponent
                  key={upload.id}
                  upload={upload}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                  retrying={retrying}
                  deleting={deleting}
                  downloading={downloading}
                  copying={copying}
                  selected={selectedUploads.has(upload.id)}
                  onSelect={handleSelectUpload}
                  apiKey={apiKey}
                  copySuccess={copySuccess}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-text dark:text-primary-text-dark">
          Uploads
        </h1>
        <div className="flex gap-2">
          {selectedUploads.size > 0 && (
            <>
              {activeTab === 'failed' && (
                <button
                  onClick={handleBulkRetry}
                  disabled={bulkRetrying}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-opacity"
                >
                  {bulkRetrying ? 'Retrying...' : `Retry Selected (${selectedUploads.size})`}
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-opacity"
              >
                {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedUploads.size})`}
              </button>
            </>
          )}
          <button
            onClick={() => {
              fetchUploads();
              fetchStatusCounts();
            }}
            className="px-4 py-2 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-4 items-center">
        <select
          value={filters.type}
          onChange={(e) => {
            setFilters((prev) => ({ ...prev, type: e.target.value }));
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg text-primary-text dark:text-primary-text-dark"
        >
          <option value="">All Types</option>
          <option value="torrent">Torrent</option>
          <option value="usenet">Usenet</option>
          <option value="webdl">WebDL</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="border-b border-border dark:border-border-dark">
        <div className="flex gap-1">
          {STATUS_TABS.map((status) => {
            const count = statusCounts[status] || 0;
            const isActive = activeTab === status;
            return (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                    : 'border-transparent text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:border-border dark:hover:border-border-dark'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {count > 0 && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      isActive
                        ? 'bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark'
                        : 'bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Statistics / Rate Limit Status */}
      {uploadStatistics && (
        <div className="mt-4 p-4 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-2">
                Upload Statistics (Last Hour)
              </h3>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                    Total:{' '}
                  </span>
                  <span className="font-medium text-primary-text dark:text-primary-text-dark">
                    {uploadStatistics.lastHour.total}
                  </span>
                  <span className="text-primary-text/50 dark:text-primary-text-dark/50">
                    {' '}
                    / {uploadStatistics.rateLimit.perHour}
                  </span>
                </div>
                {uploadStatistics.lastHour.torrents > 0 && (
                  <div>
                    <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                      Torrents:{' '}
                    </span>
                    <span className="font-medium text-primary-text dark:text-primary-text-dark">
                      {uploadStatistics.lastHour.torrents}
                    </span>
                  </div>
                )}
                {uploadStatistics.lastHour.usenets > 0 && (
                  <div>
                    <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                      Usenets:{' '}
                    </span>
                    <span className="font-medium text-primary-text dark:text-primary-text-dark">
                      {uploadStatistics.lastHour.usenets}
                    </span>
                  </div>
                )}
                {uploadStatistics.lastHour.webdls > 0 && (
                  <div>
                    <span className="text-primary-text/70 dark:text-primary-text-dark/70">
                      WebDLs:{' '}
                    </span>
                    <span className="font-medium text-primary-text dark:text-primary-text-dark">
                      {uploadStatistics.lastHour.webdls}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour * 0.8 && (
              <div
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour
                    ? 'bg-yellow-500/20 text-yellow-600 dark:bg-yellow-400/20 dark:text-yellow-400'
                    : 'bg-blue-500/20 text-blue-600 dark:bg-blue-400/20 dark:text-blue-400'
                }`}
              >
                {uploadStatistics.lastHour.total >= uploadStatistics.rateLimit.perHour
                  ? '⚠️ Rate limit reached'
                  : '⚠️ Approaching rate limit'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/20 text-red-500 dark:bg-red-400/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* Copy Success Message */}
      {copySuccess && (
        <div className="p-2 bg-green-500/20 text-green-500 dark:bg-green-400/20 dark:text-green-400 rounded-lg text-sm">
          Link copied to clipboard!
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {/* Uploads Table */}
      {!loading && (
        <>
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              No {activeTab} uploads found
            </div>
          ) : (
            <>
              {activeTab === 'queued' ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  {renderTable(true)}
                </DndContext>
              ) : (
                renderTable(false)
              )}
            </>
          )}

          {/* Improved Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}{' '}
                to {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} uploads
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))
                  }
                  disabled={pagination.page === 1}
                  className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {getPageNumbers().map((page, index) => {
                    if (page === '...') {
                      return (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-2 py-2 text-primary-text/50 dark:text-primary-text-dark/50"
                        >
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setPagination((prev) => ({ ...prev, page }))}
                        className={`px-3 py-2 rounded-lg transition-colors ${
                          pagination.page === page
                            ? 'bg-accent dark:bg-accent-dark text-white'
                            : 'bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() =>
                    setPagination((prev) => ({
                      ...prev,
                      page: Math.min(prev.totalPages, prev.page + 1),
                    }))
                  }
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark rounded-lg disabled:opacity-50 hover:bg-surface dark:hover:bg-surface-dark transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
