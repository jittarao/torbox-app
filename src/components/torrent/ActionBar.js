'use client';
import { useState } from 'react';
import ColumnManager from './ColumnManager';
import { COLUMNS, STATUS_OPTIONS } from './constants';
import Dropdown from '../shared/Dropdown';

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

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    onSearch(value);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mt-4 justify-between">
      <div className="flex gap-4 items-center flex-wrap">
        <div className="text-md text-gray-700 dark:text-gray-300">
          {torrents.length} torrents
        </div>

        {(selectedItems.torrents.size > 0 || hasSelectedFiles()) && (
          <button
            onClick={() => setSelectedItems({ torrents: new Set(), files: new Map() })}
            className="text-sm text-blue-500 hover:text-blue-600"
          >
            Clear selection
          </button>
        )}

        {(selectedItems.torrents.size > 0 || hasSelectedFiles()) && (
          <button
            onClick={onBulkDownload}
            disabled={isDownloading}
            className="bg-blue-500 text-sm text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isDownloading ? 'Fetching Links...' : 'Get Download Links'}
          </button>
        )}
        
        {selectedItems.torrents.size > 0 && !hasSelectedFiles() && (
          <button
            onClick={onBulkDelete}
            disabled={isDeleting}
            className="bg-red-500 text-sm text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : `Delete Selected (${selectedItems.torrents.size})`}
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
          className="p-2 border text-sm rounded bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 outline-none"
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