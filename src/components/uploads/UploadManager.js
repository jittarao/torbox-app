'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import Spinner from '../shared/Spinner';
import { useUploads } from './hooks/useUploads';
import { useUploadActions } from './hooks/useUploadActions';
import UploadTabs from './UploadTabs';
import UploadPagination from './UploadPagination';
import UploadStatistics from './UploadStatistics';
import UploadFilters from './UploadFilters';
import UploadTable from './UploadTable';
import { useBackendMode } from '@/hooks/useBackendMode';
import { normalizeUploadId } from './utils';

export default function UploadManager({ apiKey }) {
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const isBackendAvailable = backendMode === 'backend';
  const [activeTab, setActiveTab] = useState('queued');
  // Input value (immediate updates for UI responsiveness)
  const [searchInput, setSearchInput] = useState('');
  // Debounced search value (triggers API calls)
  const [filters, setFilters] = useState({
    type: '',
    search: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [selectedUploads, setSelectedUploads] = useState(new Set());

  const {
    uploads,
    setUploads,
    loading,
    refreshing,
    error,
    statusCounts,
    uploadStatistics,
    fetchUploads,
    fetchStatusCounts,
  } = useUploads(apiKey, activeTab, filters, pagination, setPagination);

  const {
    retrying,
    deleting,
    downloading,
    copying,
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
  } = useUploadActions(apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debounce search input - update search value after 500ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput }));
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeTab, filters.search]);

  // Drop selection from other tabs/pages so bulk actions match visible checkboxes
  useEffect(() => {
    setSelectedUploads(new Set());
  }, [activeTab, filters.type, filters.search, pagination.page]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const ids = uploads
        .map((u) => normalizeUploadId(u.id))
        .filter((id) => id !== null);
      setSelectedUploads(new Set(ids));
    } else {
      setSelectedUploads(new Set());
    }
  };

  const handleSelectUpload = (id, checked) => {
    const uploadId = normalizeUploadId(id);
    if (uploadId == null) return;

    setSelectedUploads((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(uploadId);
      } else {
        next.delete(uploadId);
      }
      return next;
    });
  };

  const showBulkActions = activeTab === 'failed' || activeTab === 'completed';
  const selectedCount = selectedUploads.size;

  const onDragEnd = (event) => {
    handleDragEnd(event, uploads, setUploads);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-text dark:text-primary-text-dark">
          Uploads
        </h1>
        <div className="flex gap-2 items-center">
          <UploadFilters
            filters={filters}
            setFilters={setFilters}
            setPagination={setPagination}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            compact={true}
          />
          {showBulkActions && (
            <>
              {activeTab === 'failed' && (
                <button
                  type="button"
                  onClick={() => handleBulkRetry(selectedUploads, uploads)}
                  disabled={bulkRetrying || selectedCount === 0}
                  className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 dark:bg-accent-dark dark:hover:bg-accent-dark/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {bulkRetrying ? 'Retrying...' : `Retry Selected (${selectedCount})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleBulkDelete(selectedUploads)}
                disabled={bulkDeleting || selectedCount === 0}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedCount})`}
              </button>
              {activeTab === 'failed' && (statusCounts.failed || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => handleClearAllFailed(filters)}
                  disabled={bulkDeleting}
                  className="px-4 py-2 bg-surface-alt dark:bg-surface-alt-dark border border-border dark:border-border-dark text-primary-text dark:text-primary-text-dark rounded-lg hover:bg-surface dark:hover:bg-surface-dark disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {bulkDeleting ? 'Deleting...' : 'Clear All Failed'}
                </button>
              )}
            </>
          )}
          <button
            type="button"
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

      <UploadStatistics uploadStatistics={uploadStatistics} />

      {!backendIsLoading && !isBackendAvailable && (
        <div className="p-4 bg-yellow-500/20 text-yellow-600 dark:bg-yellow-400/20 dark:text-yellow-400 rounded-lg">
          Upload logs feature is disabled when backend is disabled.
        </div>
      )}

      <UploadTabs activeTab={activeTab} setActiveTab={setActiveTab} statusCounts={statusCounts} />

      {error && (
        <div className="p-4 bg-red-500/20 text-red-500 dark:bg-red-400/20 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {copySuccess && (
        <div className="p-2 bg-green-500/20 text-green-500 dark:bg-green-400/20 dark:text-green-400 rounded-lg text-sm">
          Link copied to clipboard!
        </div>
      )}

      {loading && uploads.length === 0 && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {(!loading || uploads.length > 0) && (
        <>
          {!backendIsLoading && !isBackendAvailable ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              Upload logs are not available when backend is disabled.
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              {filters.search
                ? 'No uploads match your search criteria'
                : `No ${activeTab} uploads found`}
            </div>
          ) : (
            <div
              className={`relative ${refreshing ? 'opacity-60 pointer-events-none' : ''}`}
              aria-busy={refreshing}
            >
              {refreshing && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <Spinner />
                </div>
              )}
              {activeTab === 'queued' ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onDragEnd}
                >
                  <UploadTable
                    uploads={uploads}
                    enableDnd={true}
                    onRetry={handleRetry}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    onCopy={handleCopy}
                    retrying={retrying}
                    deleting={deleting}
                    downloading={downloading}
                    copying={copying}
                    selectedUploads={selectedUploads}
                    onSelect={handleSelectUpload}
                    onSelectAll={handleSelectAll}
                    copySuccess={copySuccess}
                  />
                </DndContext>
              ) : (
                <UploadTable
                  uploads={uploads}
                  enableDnd={false}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onDownload={handleDownload}
                  onCopy={handleCopy}
                  retrying={retrying}
                  deleting={deleting}
                  downloading={downloading}
                  copying={copying}
                  selectedUploads={selectedUploads}
                  onSelect={handleSelectUpload}
                  onSelectAll={handleSelectAll}
                  copySuccess={copySuccess}
                />
              )}
            </div>
          )}

          <UploadPagination pagination={pagination} setPagination={setPagination} />
        </>
      )}
    </div>
  );
}
