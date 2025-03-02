'use client';

import { useState, useEffect } from 'react';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import ActionBar from './ActionBar/index';
import { useColumnManager } from '../shared/hooks/useColumnManager';
import { useColumnWidths } from '@/hooks/useColumnWidths';
import { useDelete } from '../shared/hooks/useDelete';
import { useFilter } from '../shared/hooks/useFilter';
import { useSort } from '../shared/hooks/useSort';

// Local storage key for mobile notice dismissal
const MOBILE_NOTICE_DISMISSED_KEY = 'mobile-notice-dismissed';

export default function ItemsTable({
  apiKey,
  activeType,
  items,
  setItems,
  fetchItems,
  selectedItems,
  setSelectedItems,
  handleSelectAll,
  handleFileSelect,
  hasSelectedFiles,
  handleRowSelect,
  isDownloading,
  handleBulkDownload,
  setToast,
  isFullscreen = false,
  onFullscreenToggle,
}) {
  const [showMobileNotice, setShowMobileNotice] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);

  // Load mobile notice dismissal preference from localStorage
  useEffect(() => {
    setIsClient(true);

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

  const { columnWidths, updateColumnWidth } = useColumnWidths(activeType);
  const { activeColumns, handleColumnChange } = useColumnManager(activeType);
  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } =
    useFilter(items);
  const { sortField, sortDirection, handleSort, sortTorrents } = useSort();
  const { isDeleting, deleteItem, deleteItems } = useDelete(
    apiKey,
    setItems,
    setSelectedItems,
    setToast,
    fetchItems,
    activeType,
  );

  const sortedItems = sortTorrents(filteredItems);

  return (
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
          onBulkDownload={() => handleBulkDownload(selectedItems, sortedItems)}
          isDeleting={isDeleting}
          onBulkDelete={() => deleteItems(selectedItems)}
          className="bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark"
          activeType={activeType}
          isBlurred={isBlurred}
          onBlurToggle={() => setIsBlurred(!isBlurred)}
          isFullscreen={isFullscreen}
          onFullscreenToggle={onFullscreenToggle}
        />
      </div>

      {/* Mobile notice - only show if isClient (client-side) to prevent hydration mismatch */}
      {isClient && showMobileNotice && (
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
        <table className="min-w-full table-fixed divide-y divide-border dark:divide-border-dark relative">
          <TableHeader
            activeColumns={activeColumns}
            columnWidths={isClient ? columnWidths : {}} // Only pass widths on client
            updateColumnWidth={updateColumnWidth}
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
            columnWidths={columnWidths}
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
    </div>
  );
}
