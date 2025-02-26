'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ColumnManager from './ColumnManager';
import Dropdown from '@/components/shared/Dropdown';
import { COLUMNS, STATUS_OPTIONS } from '@/components/constants';
import useIsMobile from '@/hooks/useIsMobile';
import { saEvent } from '@/utils/sa';

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
  const isMobile = useIsMobile();

  useEffect(() => {
    const element = stickyRef.current;
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' },
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
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

  const getTotalSelectedFiles = useCallback((selectedItems) => {
    return Array.from(selectedItems.files.values()).reduce(
      (total, files) => total + files.size,
      0,
    );
  }, []);

  // Get the appropriate item name based on active type
  const getItemTypeName = useCallback(() => {
    switch (activeType) {
      case 'usenet':
        return 'usenet';
      case 'webdl':
        return 'web download';
      default:
        return 'torrent';
    }
  }, [activeType]);

  const itemTypeName = getItemTypeName();
  const itemTypePlural = `${itemTypeName}s`;

  // Find the matching status from STATUS_OPTIONS
  const getMatchingStatus = (item) => {
    const isQueued =
      !item.download_state && !item.download_finished && !item.active;
    if (isQueued) return { label: 'Queued' };

    return STATUS_OPTIONS.find((option) => {
      if (option.value === 'all' || option.value.is_queued) return false;

      return Object.entries(option.value).every(([key, value]) => {
        if (key === 'download_state') {
          const states = Array.isArray(value) ? value : [value];
          return states.some((state) => item.download_state?.includes(state));
        }
        return item[key] === value;
      });
    });
  };

  // Get the styles for each status
  const getStatusStyles = useCallback((status) => {
    switch (status) {
      case 'Queued':
      case 'Downloading':
        return 'text-label-warning-text dark:text-label-warning-text-dark';
      case 'Seeding':
        return 'text-label-active-text dark:text-label-active-text-dark';
      case 'Completed':
        return 'text-label-success-text dark:text-label-success-text-dark';
      case 'Failed':
      case 'Inactive':
        return 'text-label-danger-text dark:text-label-danger-text-dark';
      default:
        return 'text-label-default-text dark:text-label-default-text-dark';
    }
  }, []);

  // Get the status for each item
  const itemStatuses = useMemo(() => {
    return items.map((item) => {
      const status = getMatchingStatus(item);
      return {
        [item.id]: status,
      };
    });
  }, [items]);

  // Get the count of each status
  const statusCounts = useMemo(() => {
    let localStatusCounts = itemStatuses.reduce((acc, curr) => {
      const status = curr[Object.keys(curr)[0]];
      if (status) {
        acc[status.label] = (acc[status.label] || 0) + 1;
      }
      return acc;
    }, {});

    // localStatusCounts is an object with status labels as keys and counts as values
    // STATUS_OPTIONS is an array of objects with label, value keys
    // Reorder localStatusCounts to match the order in which label keys appear in STATUS_OPTIONS
    const orderedStatusCounts = {};
    STATUS_OPTIONS.forEach((option) => {
      orderedStatusCounts[option.label] = localStatusCounts[option.label] || 0;
    });

    return orderedStatusCounts;
  }, [itemStatuses]);

  // Update the label key in STATUS_OPTIONS to the format {label (count)}
  const StatusOptions = useMemo(() => {
    return STATUS_OPTIONS.map((option) => {
      let localOption = {};
      if (option.label === 'All') {
        localOption = {
          ...option,
          label: `All (${items.length})`,
        };
      } else {
        localOption = {
          ...option,
          label: `${option.label} (${statusCounts[option.label] || 0})`,
        };
      }
      return localOption;
    });
  }, [statusCounts]);

  return (
    <div
      ref={stickyRef}
      className={`flex flex-col lg:flex-row gap-4 py-4 justify-between bg-surface dark:bg-surface-dark
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap">
        <div className="text-md text-primary-text dark:text-primary-text-dark">
          <span className="font-semibold">
            {items.length} {items.length === 1 ? itemTypeName : itemTypePlural}
          </span>
          <div className="flex flex-wrap gap-3 mt-1.5">
            {Object.entries(statusCounts)
              .filter(([status, count]) => count !== 0)
              .map(([status, count]) => (
                <span
                  key={status}
                  className={`text-sm font-medium ${getStatusStyles(status)}`}
                >
                  {count} {status.toLowerCase()}
                </span>
              ))}
          </div>
        </div>

        <div className="flex gap-4 items-center">
          {(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
            <button
              onClick={() => {
                handleDownloadClick();
                saEvent('download_items');
              }}
              disabled={isDownloading}
              className="bg-accent text-white text-xs lg:text-sm px-4 py-2 rounded hover:bg-accent/90 
              disabled:opacity-50 transition-colors"
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
                      ? `${isMobile ? 'Get Links' : 'Get Download Links'} (${parts.join(', ')})`
                      : `${isMobile ? 'Get Links' : 'Get Download Links'}`;
                  })()}
            </button>
          )}

          {selectedItems.items?.size > 0 && !hasSelectedFiles() && (
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-500 text-white text-xs lg:text-sm px-4 py-2 rounded hover:bg-red-600 
                disabled:opacity-50 transition-colors"
              >
                {isMobile ? 'Delete' : 'Delete Selected'} (
                {selectedItems.items?.size})
              </button>

              {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg shadow-lg max-w-md">
                    <h3 className="text-lg font-semibold mb-4 text-primary-text dark:text-primary-text-dark">
                      Confirm Delete
                    </h3>
                    <p className="text-primary-text/70 dark:text-primary-text-dark/70 mb-6">
                      Are you sure you want to delete{' '}
                      {selectedItems.items?.size}{' '}
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
              {isMobile ? 'Clear' : 'Clear selection'}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Dropdown
          options={StatusOptions}
          value={statusFilter}
          onChange={(value) => {
            onStatusChange(value);
          }}
          className="min-w-[150px]"
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

        <div className="hidden lg:block">
          <ColumnManager
            columns={COLUMNS}
            activeColumns={activeColumns}
            onColumnChange={onColumnChange}
            activeType={activeType}
          />
        </div>
      </div>
    </div>
  );
}
