'use client';

import { useState, useEffect, useCallback, useEffectEvent } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import Spinner from '../shared/Spinner';
import { useUploads } from './hooks/useUploads';
import { useUploadActions } from './hooks/useUploadActions';
import UploadTabs from './UploadTabs';
import UploadStatistics from './UploadStatistics';
import UploadFilters from './UploadFilters';
import UploadManagerTableSection from './UploadManagerTableSection';
import { useBackendMode } from '@/hooks/useBackendMode';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactToolbarClass } from '@/components/shared/compactToolbar';
import { Refresh, RotateCcw, Trash, XCircle } from '@/components/icons';
import { normalizeUploadId } from './utils';
import { useShiftRangeRowSelection } from '@/hooks/useShiftRangeRowSelection';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';

export default function UploadManager({ apiKey }) {
  const { mode: backendMode, isLoading: backendIsLoading } = useBackendMode();
  const isBackendAvailable = backendMode === 'backend';
  const [activeTab, setActiveTab] = useState('queued');
  const [searchInput, setSearchInput] = useState('');
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
    error,
    statusCounts,
    uploadStatistics,
    fetchUploads,
    fetchStatusCounts,
  } = useUploads(apiKey, activeTab, filters, pagination, setPagination);

  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });
  const { alert, AppAlert } = useAppAlert();

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
  } = useUploadActions(apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads, confirm, alert);

  const getUploadRowId = useCallback((upload) => normalizeUploadId(upload.id), []);
  const { buildSelectionUpdater, resetAnchor } = useShiftRangeRowSelection(uploads, getUploadRowId);

  const clearUploadSelection = useCallback(() => {
    setSelectedUploads(new Set());
    resetAnchor();
  }, [resetAnchor]);

  const resetPaginationPage = useCallback(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, []);

  const handleActiveTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      resetPaginationPage();
      clearUploadSelection();
    },
    [resetPaginationPage, clearUploadSelection]
  );

  const paginationRef = useLatestRef(pagination);
  const filtersRef = useLatestRef(filters);

  const handlePaginationChange = useCallback(
    (updater) => {
      const prev = paginationRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next.page !== prev.page) {
        clearUploadSelection();
      }
      setPagination(next);
    },
    [clearUploadSelection, paginationRef]
  );

  const handleFiltersChange = useCallback(
    (updater) => {
      const prev = filtersRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      const scopeChanged = next.type !== prev.type || next.search !== prev.search;
      setFilters(next);
      if (scopeChanged) {
        resetPaginationPage();
        clearUploadSelection();
      }
    },
    [resetPaginationPage, clearUploadSelection, filtersRef]
  );

  const handleFiltersChangeEvent = useEffectEvent(handleFiltersChange);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleFiltersChangeEvent((prev) =>
        prev.search === searchInput ? prev : { ...prev, search: searchInput }
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

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

  const showBulkActions =
    activeTab === 'queued' || activeTab === 'failed' || activeTab === 'completed';
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
            setFilters={handleFiltersChange}
            setPagination={handlePaginationChange}
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
              fetchUploads({ silent: true });
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

      <UploadTabs
        activeTab={activeTab}
        setActiveTab={handleActiveTabChange}
        statusCounts={statusCounts}
      />

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

      {loading && uploads.length === 0 ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <UploadManagerTableSection
          activeTab={activeTab}
          loading={loading}
          uploads={uploads}
          filters={filters}
          backendIsLoading={backendIsLoading}
          isBackendAvailable={isBackendAvailable}
          onDragEnd={onDragEnd}
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
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
        />
      )}

      <ConfirmDialog />
      <AppAlert />
    </div>
  );
}
