'use client';
import { useState, useRef, useEffect } from 'react';
import ColumnManager from './ColumnManager';
import { COLUMNS, STATUS_OPTIONS } from './constants';
import Dropdown from '@/components/shared/Dropdown';

const getTotalSelectedFiles = (selectedItems) => {
  let total = 0;
  selectedItems.files.forEach(files => {
    total += files.size;
  });
  return total;
};

export default function ActionBar({ 
  torrents, 
  selectedItems, 
  setSelectedItems,
  hasSelectedFiles, 
  activeColumns, 
  onColumnChange,
  onSearch,
  onStatusChange,
  isDownloading,
  isDeleting,
  onBulkDownload,
  onBulkDelete
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => setIsSticky(!e.isIntersecting),
      { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
    );

    if (stickyRef.current) {
      observer.observe(stickyRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    onSearch(value);
  };

  const handleDownloadClick = () => {
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Call the original download handler
    onBulkDownload();
  };

  return (
    <div 
      ref={stickyRef}
      className={`flex flex-col sm:flex-row gap-4 py-4 justify-between bg-surface dark:bg-surface-dark
        ${isSticky ? 'border-b border-border dark:border-border-dark' : ''}`}
    >
      <div className="flex gap-4 items-center flex-wrap">
        <div className="text-md text-primary-text dark:text-primary-text-dark">
          {torrents.length} {torrents.length === 1 ? 'torrent' : 'torrents'}
        </div>

        {(selectedItems.torrents.size > 0 || hasSelectedFiles()) && (
          <button
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="bg-accent text-white px-4 py-2 rounded hover:bg-accent/90 
              disabled:opacity-50 transition-colors text-sm"
          >
            {isDownloading ? 'Fetching Links...' : (() => {
              const torrentText = selectedItems.torrents.size > 0 
                ? `${selectedItems.torrents.size} ${selectedItems.torrents.size === 1 ? 'torrent' : 'torrents'}`
                : '';
              
              const fileCount = getTotalSelectedFiles(selectedItems);
              const fileText = fileCount > 0 
                ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}`
                : '';

              const parts = [torrentText, fileText].filter(Boolean);
              return parts.length > 0 
                ? `Get Download Links (${parts.join(', ')})`
                : 'Get Download Links';
            })()}
          </button>
        )}
        
        {selectedItems.torrents.size > 0 && !hasSelectedFiles() && (
          <>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500 text-sm text-white px-4 py-2 rounded hover:bg-red-600 
                disabled:opacity-50 transition-colors"
            >
              Delete Selected ({selectedItems.torrents.size})
            </button>

            {showDeleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-surface dark:bg-surface-dark p-6 rounded-lg shadow-lg max-w-md">
                  <h3 className="text-lg font-semibold mb-4 text-primary-text dark:text-primary-text-dark">
                    Confirm Delete
                  </h3>
                  <p className="text-primary-text/70 dark:text-primary-text-dark/70 mb-6">
                    Are you sure you want to delete {selectedItems.torrents.size} {selectedItems.torrents.size === 1 ? 'torrent' : 'torrents'}? This action cannot be undone.
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

        {(selectedItems.torrents.size > 0 || selectedItems.files.size > 0) && (
          <button
            onClick={() => setSelectedItems({ torrents: new Set(), files: new Map() })}
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
            setStatusFilter(value);
            onStatusChange(value);
          }}
          className="min-w-[140px]"
        />
        
        <input
          type="text"
          placeholder="Search torrents..."
          value={search}
          onChange={handleSearchChange}
          className="p-2 border border-border dark:border-border-dark rounded text-sm 
            bg-transparent text-primary-text dark:text-primary-text-dark 
            placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
            focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
            focus:border-accent dark:focus:border-accent-dark transition-colors"
        />
        <ColumnManager 
          columns={COLUMNS}
          activeColumns={activeColumns}
          onColumnChange={onColumnChange}
        />
      </div>
    </div>
  );
} 