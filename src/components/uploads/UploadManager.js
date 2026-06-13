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
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactToolbarClass } from '@/components/shared/compactToolbar';
import { Refresh, RotateCcw, Trash, XCircle } from '@/components/icons';
import { normalizeUploadId } from './utils';
import { useShiftRangeRowSelection } from '@/hooks/useShiftRangeRowSelection';

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

  const getUploadRowId = useCallback((upload) => normalizeUploadId(upload.id), []);
  const { buildSelectionUpdater, resetAnchor } = useShiftRangeRowSelection(uploads, getUploadRowId);

  // Drop selection from other tabs/pages so bulk actions match visible checkboxes
  useEffect(() => {
    setSelectedUploads(new Set());
    resetAnchor();
  }, [activeTab, filters.type, filters.search, pagination.page, resetAnchor]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const ids = uploads.map((u) => normalizeUploadId(u.id)).filter((id) => id !== null);
      setSelectedUploads(new Set(ids));
    } else {
      setSelectedUploads(new Set());
    }
  };

  const handleSelectUpload = (id, checked, rowIndex, isShiftKey = false) => {
    const uploadId = normalizeUploadId(id);
    if (uploadId == null) return;

    setSelectedUploads(buildSelectionUpdater(uploadId, checked, rowIndex, isShiftKey));
  };

  const showBulkActions = activeTab === 'failed' || activeTab === 'completed';
  const selectedCount = selectedUploads.size;

  const onDragEnd = (event) => {
    handleDragEnd(event, uploads, setUploads);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-primary-text dark:text-primary-text-dark">
          Uploads
        </h1>
        <div className={compactToolbarClass} role="toolbar" aria-label="Upload actions">
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
                <BulkActionButton
                  variant="accent"
                  onClick={() => handleBulkRetry(selectedUploads, uploads)}
                  disabled={selectedCount === 0}
                  loading={bulkRetrying}
                  icon={<RotateCcw />}
                  label={bulkRetrying ? 'Retrying' : `Retry (${selectedCount})`}
                  title="Retry selected uploads"
                />
              )}
              <BulkActionButton
                variant="danger"
                onClick={() => handleBulkDelete(selectedUploads)}
                disabled={selectedCount === 0}
                loading={bulkDeleting}
                icon={<Trash />}
                label={bulkDeleting ? 'Deleting' : `Delete (${selectedCount})`}
                title="Delete selected uploads"
              />
              {activeTab === 'failed' && (statusCounts.failed || 0) > 0 && (
                <BulkActionButton
                  variant="secondary"
                  onClick={() => handleClearAllFailed(filters)}
                  loading={bulkDeleting}
                  icon={<XCircle />}
                  label={bulkDeleting ? 'Clearing' : 'Clear failed'}
                  title="Clear all failed uploads"
                />
              )}
            </>
          )}
          <BulkActionButton
            variant="primary"
            onClick={() => {
              fetchUploads();
              fetchStatusCounts();
            }}
            icon={<Refresh />}
            label="Refresh"
            title="Refresh upload list"
          />
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
