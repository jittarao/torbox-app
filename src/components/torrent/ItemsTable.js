'use client';

import { useState, useMemo } from 'react';
import { useTorrentData } from './hooks/useTorrentData';
import { useUsenetData } from '../usenet/hooks/useUsenetData';
import { useWebdlData } from '../webdl/hooks/useWebdlData';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useDelete } from '../shared/hooks/useDelete';
import { useDownloads } from '../shared/hooks/useDownloads';
import { useFilter } from '../shared/hooks/useFilter';
import { useSelection } from '../shared/hooks/useSelection';
import { useSort } from '../shared/hooks/useSort';
import AssetTypeTabs from '@/components/shared/AssetTypeTabs';
import ItemUploader from './ItemUploader';
import DownloadPanel from './DownloadPanel';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import ActionBar from './ActionBar';
import Toast from '@/components/shared/Toast';

export default function ItemsTable({ apiKey }) {
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('torrents');
  const [showMobileNotice, setShowMobileNotice] = useState(true);

  // Data hooks for different asset types
  const {
    torrents,
    loading: torrentLoading,
    setTorrents,
    fetchTorrents,
  } = useTorrentData(apiKey);

  const {
    usenetItems,
    loading: usenetLoading,
    setUsenetItems,
    fetchUsenetItems,
  } = useUsenetData(apiKey);

  const {
    webdlItems,
    loading: webdlLoading,
    setWebdlItems,
    fetchWebdlItems,
  } = useWebdlData(apiKey);

  // Determine which data to use based on active type
  const getSetActiveData = () => {
    switch (activeType) {
      case 'usenet':
        return setUsenetItems;
      case 'webdl':
        return setWebdlItems;
      default:
        return setTorrents;
    }
  };

  const getFetchActiveData = () => {
    switch (activeType) {
      case 'usenet':
        return fetchUsenetItems;
      case 'webdl':
        return fetchWebdlItems;
      default:
        return fetchTorrents;
    }
  };

  const isLoading = () => {
    switch (activeType) {
      case 'usenet':
        return usenetLoading;
      case 'webdl':
        return webdlLoading;
      default:
        return torrentLoading;
    }
  };

  const activeData = useMemo(() => {
    switch (activeType) {
      case 'usenet':
        return usenetItems || [];
      case 'webdl':
        return webdlItems || [];
      default:
        return torrents || [];
    }
  }, [activeType, torrents, usenetItems, webdlItems]);

  const setActiveData = getSetActiveData();
  const fetchActiveData = getFetchActiveData();
  const loading = isLoading();

  // Shared hooks
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(activeData);
  const { sortField, sortDirection, handleSort, sortTorrents } = useSort();
  const {
    selectedItems,
    handleSelectAll,
    handleFileSelect,
    hasSelectedFiles,
    handleRowSelect,
    setSelectedItems,
  } = useSelection();
  const { activeColumns, handleColumnChange } = useColumnManager(activeType);
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
  } = useDownloads(apiKey, activeType);

  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setActiveData,
    setSelectedItems,
    setToast,
    fetchActiveData,
    activeType,
  );

  const sortedItems = sortTorrents(filteredItems);

  if (loading && activeData.length === 0)
    return (
      <div className="text-center text-primary-text dark:text-primary-text-dark">
        Loading...
      </div>
    );

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

      <DownloadPanel
        downloadLinks={downloadLinks}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onDismiss={() => setDownloadLinks([])}
        setToast={setToast}
      />

      {/* Divider */}
      <div className="h-px w-full border-t border-border dark:border-border-dark"></div>

      {/* Wrap ActionBar in a sticky container */}
      <div className="sticky top-0 z-20">
        <ActionBar
          items={sortedItems}
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
          onBulkDownload={() => handleBulkDownload(selectedItems, sortedItems)}
          isDeleting={isDeleting}
          onBulkDelete={() => deleteItems(selectedItems)}
          className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark"
          activeType={activeType}
        />
      </div>

      {/* Mobile notice */}
      {showMobileNotice && (
        <div className="md:hidden p-3 my-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex justify-between items-center">
          <p>
            Viewing simplified table on mobile. Rotate device or use larger
            screen for full view.
          </p>
          <button
            onClick={() => setShowMobileNotice(false)}
            className="ml-2 text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
            aria-label="Dismiss notice"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
        <table className="min-w-full divide-y divide-border dark:divide-border-dark relative">
          <TableHeader
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            onSelectAll={handleSelectAll}
            items={sortedItems}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableBody
            items={sortedItems}
            setItems={setActiveData}
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            onRowSelect={handleRowSelect}
            onFileSelect={handleFileSelect}
            setSelectedItems={setSelectedItems}
            apiKey={apiKey}
            onDelete={deleteItem}
            setToast={setToast}
            activeType={activeType}
          />
        </table>
      </div>

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
