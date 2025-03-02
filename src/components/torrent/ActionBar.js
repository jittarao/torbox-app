'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ColumnManager from './ColumnManager';
import StatusFilterDropdown from '@/components/shared/StatusFilterDropdown';
import { COLUMNS, STATUS_OPTIONS, Icons } from '@/components/constants';
import useIsMobile from '@/hooks/useIsMobile';
import { saEvent } from '@/utils/sa';
import isEqual from 'lodash/isEqual';

export default function ActionBar({
  unfilteredItems,
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
  isBlurred = false,
  onBlurToggle,
  isFullscreen = false,
  onFullscreenToggle,
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

  const handleSearchChange = (value) => {
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
      case 'Uploading':
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
    return unfilteredItems.map((item) => {
      const status = getMatchingStatus(item);
      return {
        [item.id]: status,
      };
    });
  }, [unfilteredItems]);

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
          label: `All (${unfilteredItems.length})`,
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
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''} ${isFullscreen ? 'px-4' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap">
        <div className="text-md text-primary-text dark:text-primary-text-dark">
          {/* Total items */}
          <span
            className={`font-semibold ${statusFilter === 'all' ? 'cursor-default' : 'cursor-pointer hover:text-accent dark:hover:text-accent-dark'}  transition-colors`}
            onClick={() => onStatusChange('all')}
          >
            {unfilteredItems.length} {itemTypePlural}
          </span>

          {/* Status counts list */}
          {!(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
            <div className="flex flex-wrap gap-3 mt-1.5">
              {Object.entries(statusCounts)
                .filter(([status, count]) => count !== 0)
                .map(([status, count]) => {
                  const isSelected =
                    statusFilter !== 'all' &&
                    isEqual(
                      STATUS_OPTIONS.find((opt) => opt.label === status)?.value,
                      JSON.parse(statusFilter),
                    );
                  return (
                    <span
                      key={status}
                      onClick={() => {
                        const option = STATUS_OPTIONS.find(
                          (opt) => opt.label === status,
                        );
                        if (option) {
                          const newValue =
                            typeof option.value === 'object'
                              ? JSON.stringify(option.value)
                              : option.value;
                          onStatusChange(newValue);
                        }
                      }}
                      className={`text-sm font-medium border-b border-dashed 
                        ${getStatusStyles(status)}
                        ${statusFilter !== 'all' && isSelected ? 'opacity-100' : statusFilter !== 'all' ? 'opacity-60' : 'opacity-100'}
                        ${isSelected ? 'border-current cursor-default' : 'cursor-pointer hover:opacity-80 border-current/30 hover:border-current'}
                        transition-all`}
                    >
                      {count} {status.toLowerCase()}
                    </span>
                  );
                })}
            </div>
          )}
        </div>

        {/* Download button */}
        {(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
          <div className="flex gap-4 items-center">
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

            {/* Delete button */}
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

            {/* Clear selection button */}
            <button
              onClick={() =>
                setSelectedItems({ items: new Set(), files: new Map() })
              }
              className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
            >
              {isMobile ? 'Clear' : 'Clear selection'}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        {/* Status filter */}
        <StatusFilterDropdown
          options={StatusOptions}
          value={statusFilter}
          onChange={(value) => {
            onStatusChange(value);
          }}
          className="min-w-[150px]"
        />

        {/* Search */}
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-10 py-2 min-w-64 rounded-lg border border-border dark:border-border-dark 
              bg-transparent text-primary-text dark:text-primary-text-dark 
              placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
              focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
              focus:border-accent dark:focus:border-accent-dark 
              transition-colors text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 
                text-primary-text/40 dark:text-primary-text-dark/40 
                hover:text-primary-text dark:hover:text-primary-text-dark
                transition-colors"
            >
              {Icons.times}
            </button>
          )}
        </div>

        {/* Blur toggle button */}
        <button
          onClick={onBlurToggle}
          className={`px-3 py-1.5 text-sm border rounded-md transition-colors flex items-center gap-2
            ${
              isBlurred
                ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
            }`}
          title={
            isBlurred ? 'Show sensitive content' : 'Hide sensitive content'
          }
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
              d={
                isBlurred
                  ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
                  : 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
              }
            />
          </svg>
        </button>

        {/* Fullscreen toggle button */}
        <button
          onClick={onFullscreenToggle}
          className={`px-3 py-1.5 text-sm border rounded-md transition-colors flex items-center gap-2
            ${
              isFullscreen
                ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70'
            }`}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? Icons.minimize : Icons.maximize}
        </button>

        {/* Column manager */}
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
