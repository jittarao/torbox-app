'use client';

import { useState, useRef, useEffect } from 'react';
import ColumnManager from './ColumnManager';
import Dropdown from '@/components/shared/Dropdown';
import { COLUMNS, STATUS_OPTIONS } from '@/components/constants';
import { saEvent } from '@/utils/sa';

const getTotalSelectedFiles = (selectedItems) => {
  let total = 0;
  selectedItems.files.forEach((files) => {
    total += files.size;
  });
  return total;
};

export default function ActionBar({
  items,
  selectedItems,
  setSelectedItems,
  hasSelectedFiles,
  activeColumns,
  onColumnChange,
  search,
  setSearch,
  statusFilter,
  onStatusChange,
  isDownloading,
  isDeleting,
  onBulkDownload,
  onBulkDelete,
  activeType = 'torrents',
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    );

    if (stickyRef.current) {
      observer.observe(stickyRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
  };

  const handleDownloadClick = () => {
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Call the original download handler
    onBulkDownload();
  };

  // Get the appropriate item name based on active type
  const getItemTypeName = () => {
    switch (activeType) {
      case 'usenet':
        return 'usenet';
      case 'webdl':
        return 'web download';
      default:
        return 'torrent';
    }
  };

  const itemTypeName = getItemTypeName();
  const itemTypePlural = `${itemTypeName}s`;

  return (
    <div
      ref={stickyRef}
      className={`flex flex-col sm:flex-row gap-4 py-4 justify-between bg-surface dark:bg-surface-dark
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap">
        <div className="text-md text-primary-text dark:text-primary-text-dark">
          {items.length} {items.length === 1 ? itemTypeName : itemTypePlural}
        </div>

        {(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
          <button
            onClick={() => {
              handleDownloadClick();
              saEvent('download_items');
            }}
            disabled={isDownloading}
            className="bg-accent text-white px-4 py-2 rounded hover:bg-accent/90 
              disabled:opacity-50 transition-colors text-sm"
          >
            {isDownloading
              ? 'Fetching Links...'
              : (() => {
                  const torrentText =
                    selectedItems.items?.size > 0
                      ? `${selectedItems.items?.size} ${selectedItems.items?.size === 1 ? itemTypeName : itemTypePlural}`
                      : '';

                  const fileCount = getTotalSelectedFiles(selectedItems);
                  const fileText =
                    fileCount > 0
                      ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`
                      : '';

                  const parts = [torrentText, fileText].filter(Boolean);
                  return parts.length > 0
                    ? `Get Download Links (${parts.join(', ')})`
                    : 'Get Download Links';
                })()}
          </button>
        )}

        {selectedItems.items?.size > 0 && !hasSelectedFiles() && (
          <>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 text-sm text-white px-4 py-2 rounded hover:bg-red-600 
                disabled:opacity-50 transition-colors"
            >
              Delete Selected ({selectedItems.items?.size})
            </button>

            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg shadow-lg max-w-md">
                  <h3 className="text-lg font-semibold mb-4 text-primary-text dark:text-primary-text-dark">
                    Confirm Delete
                  </h3>
                  <p className="text-primary-text/70 dark:text-primary-text-dark/70 mb-6">
                    Are you sure you want to delete {selectedItems.items?.size}{' '}
                    {selectedItems.items?.size === 1
                      ? itemTypeName
                      : itemTypePlural}
                    ? This action cannot be undone.
                  </p>
                  <div className="flex justify-end gap-4">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70 
                        hover:text-primary-text dark:hover:text-primary-text-dark"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        onBulkDelete();
                        saEvent('delete_items');
                      }}
                      disabled={isDeleting}
                      className="bg-red-500 text-sm text-white px-4 py-2 rounded hover:bg-red-600 
                        disabled:opacity-50 transition-colors"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {(selectedItems.items?.size > 0 || selectedItems.files.size > 0) && (
          <button
            onClick={() =>
              setSelectedItems({ items: new Set(), files: new Map() })
            }
            className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <Dropdown
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(value) => {
            onStatusChange(value);
          }}
          className="min-w-[140px]"
        />

        <div className="relative flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 
                       text-primary-text/40 dark:text-primary-text-dark/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder={`Search ${itemTypePlural}...`}
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 min-w-64 rounded-lg border border-border dark:border-border-dark 
              bg-transparent text-primary-text dark:text-primary-text-dark 
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
              focus:border-accent dark:focus:border-accent-dark 
              transition-colors text-sm"
          />
        </div>
        <ColumnManager
          columns={COLUMNS}
          activeColumns={activeColumns}
          onColumnChange={onColumnChange}
          activeType={activeType}
        />
      </div>
    </div>
  );
}
