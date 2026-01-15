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

export default function UploadManager({ apiKey }) {
  const [activeTab, setActiveTab] = useState('queued');
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
    handleDragEnd,
  } = useUploadActions(apiKey, fetchUploads, fetchStatusCounts, setSelectedUploads);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeTab, filters.search]);

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
            compact={true}
          />
          {selectedUploads.size > 0 && (
            <>
              {activeTab === 'failed' && (
                <button
                  onClick={() => handleBulkRetry(selectedUploads, uploads)}
                  disabled={bulkRetrying}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-opacity"
                >
                  {bulkRetrying ? 'Retrying...' : `Retry Selected (${selectedUploads.size})`}
                </button>
              )}
              <button
                onClick={() => handleBulkDelete(selectedUploads)}
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

      <UploadTabs activeTab={activeTab} setActiveTab={setActiveTab} statusCounts={statusCounts} />

      <UploadStatistics uploadStatistics={uploadStatistics} />

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

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!loading && (
        <>
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
              {filters.search
                ? 'No uploads match your search criteria'
                : `No ${activeTab} uploads found`}
            </div>
          ) : (
            <>
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
            </>
          )}

          <UploadPagination pagination={pagination} setPagination={setPagination} />
        </>
      )}
    </div>
  );
}
