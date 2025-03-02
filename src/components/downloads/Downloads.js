'use client';

import { useState } from 'react';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useDelete } from '../shared/hooks/useDelete';
import { useFetchData } from '../shared/hooks/useFetchData';
import { useFilter } from '../shared/hooks/useFilter';
import { useSelection } from '../shared/hooks/useSelection';
import { useSort } from '../shared/hooks/useSort';
import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import DownloadPanel from './DownloadPanel';
import ItemUploader from './ItemUploader';
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';
import Spinner from '../shared/Spinner';
import ItemsTable from './ItemsTable';
import ActionBar from './ActionBar/index';
import CardList from './CardList';

export default function Downloads({ apiKey }) {
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('torrents');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [viewMode, setViewMode] = useState('table');

  const { loading, items, setItems, fetchItems } = useFetchData(
    apiKey,
    activeType,
  );

  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection();
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
  } = useDownloads(apiKey, activeType);

  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setItems,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType,
  );

  const { activeColumns, handleColumnChange } = useColumnManager(activeType);
  const { sortField, sortDirection, handleSort, sortTorrents } = useSort();

  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(items);

  const sortedItems = sortTorrents(filteredItems);

  const onFullscreenToggle = () => {
    setIsFullscreen((prev) => !prev);
  };

  return (
    <div>
      <AssetTypeTabs
        activeType={activeType}
        onTypeChange={(type) => {
          setActiveType(type);
          setSelectedItems({ items: new Set(), files: new Map() });
        }}
      />

      <ItemUploader apiKey={apiKey} activeType={activeType} />

      {loading && items.length === 0 ? (
        <div className="flex justify-center items-center">
          <Spinner
            size="sm"
            className="text-primary-text dark:text-primary-text-dark"
          />
        </div>
      ) : (
        <>
          <SpeedChart items={items} activeType={activeType} />

          <DownloadPanel
            downloadLinks={downloadLinks}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            onDismiss={() => setDownloadLinks([])}
            setToast={setToast}
          />

          {/* Divider */}
          <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

          <div
            className={`${isFullscreen ? 'fixed inset-0 z-50 bg-surface dark:bg-surface-dark overflow-auto' : ''}`}
          >
            {/* Wrap ActionBar in a sticky container */}
            <div className="sticky top-0 z-20">
              <ActionBar
                unfilteredItems={items}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                hasSelectedFiles={hasSelectedFiles}
                activeColumns={activeColumns}
                onColumnChange={handleColumnChange}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                isDownloading={isDownloading}
                onBulkDownload={() =>
                  handleBulkDownload(selectedItems, sortedItems)
                }
                isDeleting={isDeleting}
                onBulkDelete={() => deleteItems(selectedItems)}
                activeType={activeType}
                isBlurred={isBlurred}
                onBlurToggle={() => setIsBlurred(!isBlurred)}
                isFullscreen={isFullscreen}
                onFullscreenToggle={onFullscreenToggle}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                sortField={sortField}
                handleSort={handleSort}
              />
            </div>

            {viewMode === 'table' ? (
              <ItemsTable
                apiKey={apiKey}
                activeType={activeType}
                activeColumns={activeColumns}
                setItems={setItems}
                selectedItems={selectedItems}
                handleSelectAll={handleSelectAll}
                handleFileSelect={handleFileSelect}
                handleRowSelect={handleRowSelect}
                setSelectedItems={setSelectedItems}
                isBlurred={isBlurred}
                deleteItem={deleteItem}
                sortedItems={sortedItems}
                sortField={sortField}
                sortDirection={sortDirection}
                handleSort={handleSort}
                setToast={setToast}
              />
            ) : (
              <CardList
                items={sortedItems}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                setItems={setItems}
                apiKey={apiKey}
                onDelete={deleteItem}
                expandedItems={new Set()}
                toggleFiles={() => {}}
                setToast={setToast}
                activeType={activeType}
                isBlurred={isBlurred}
                isFullscreen={isFullscreen}
                viewMode={viewMode}
              />
            )}
          </div>
        </>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
