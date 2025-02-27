'use client';

import { useState, useEffect } from 'react';
import { useFetchData } from '../shared/hooks/useFetchData';
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
import SpeedChart from './SpeedChart';
import Toast from '@/components/shared/Toast';

// Local storage key for mobile notice dismissal
const MOBILE_NOTICE_DISMISSED_KEY = 'mobile-notice-dismissed';

export default function ItemsTable({ apiKey }) {
  const [toast, setToast] = useState(null);
  const [activeType, setActiveType] = useState('torrents');
  const [showMobileNotice, setShowMobileNotice] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);

  // Load mobile notice dismissal preference from localStorage
  useEffect(() => {
    setMounted(true);

    if (typeof localStorage !== 'undefined') {
      const noticeDismissed = localStorage.getItem(MOBILE_NOTICE_DISMISSED_KEY);
      if (noticeDismissed === 'true') {
        setShowMobileNotice(false);
      }
    }
  }, []);

  // Save mobile notice dismissal preference to localStorage
  const handleDismissMobileNotice = () => {
    setShowMobileNotice(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MOBILE_NOTICE_DISMISSED_KEY, 'true');
    }
  };

  const { loading, items, setItems, fetchItems } = useFetchData(
    apiKey,
    activeType,
  );

  // Shared hooks
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(items);
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
    setItems,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType,
  );

  const sortedItems = sortTorrents(filteredItems);

  if (loading && items.length === 0)
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
          isBlurred={isBlurred}
          onBlurToggle={() => setIsBlurred(!isBlurred)}
        />
      </div>

      {/* Mobile notice - only show if mounted (client-side) to prevent hydration mismatch */}
      {mounted && showMobileNotice && (
        <div className="md:hidden p-3 my-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm flex justify-between items-center">
          <p>
            Viewing simplified table on mobile. Rotate device or use larger
            screen for full view.
          </p>
          <button
            onClick={handleDismissMobileNotice}
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
            setItems={setItems}
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            onRowSelect={handleRowSelect}
            onFileSelect={handleFileSelect}
            setSelectedItems={setSelectedItems}
            apiKey={apiKey}
            onDelete={deleteItem}
            setToast={setToast}
            activeType={activeType}
            isBlurred={isBlurred}
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
