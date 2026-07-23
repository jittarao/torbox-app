'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import UploadTable from './UploadTable';
import UploadPagination from './UploadPagination';

export default function UploadManagerTableSection({
  activeTab,
  loading,
  uploads,
  filters,
  backendIsLoading,
  isBackendAvailable,
  onDragEnd,
  onRetry,
  onDelete,
  onDownload,
  onCopy,
  retrying,
  deleting,
  downloading,
  copying,
  selectedUploads,
  onSelect,
  onSelectAll,
  copySuccess,
  pagination,
  onPaginationChange,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!loading && uploads.length === 0) {
    return (
      <>
        {!backendIsLoading && !isBackendAvailable ? (
          <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
            Upload logs are not available when backend is disabled.
          </div>
        ) : (
          <div className="text-center py-8 text-primary-text/70 dark:text-primary-text-dark/70">
            {filters.search
              ? 'No uploads match your search criteria'
              : `No ${activeTab} uploads found`}
          </div>
        )}
        <UploadPagination pagination={pagination} setPagination={onPaginationChange} />
      </>
    );
  }

  if (uploads.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative">
        {activeTab === 'queued' ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <UploadTable
              uploads={uploads}
              enableDnd={true}
              onRetry={onRetry}
              onDelete={onDelete}
              onDownload={onDownload}
              onCopy={onCopy}
              retrying={retrying}
              deleting={deleting}
              downloading={downloading}
              copying={copying}
              selectedUploads={selectedUploads}
              onSelect={onSelect}
              onSelectAll={onSelectAll}
              copySuccess={copySuccess}
            />
          </DndContext>
        ) : (
          <UploadTable
            uploads={uploads}
            enableDnd={false}
            onRetry={onRetry}
            onDelete={onDelete}
            onDownload={onDownload}
            onCopy={onCopy}
            retrying={retrying}
            deleting={deleting}
            downloading={downloading}
            copying={copying}
            selectedUploads={selectedUploads}
            onSelect={onSelect}
            onSelectAll={onSelectAll}
            copySuccess={copySuccess}
          />
        )}
      </div>

      <UploadPagination pagination={pagination} setPagination={onPaginationChange} />
    </>
  );
}
