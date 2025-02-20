'use client';
import { useState } from 'react';
import { useTorrentData } from './hooks/useTorrentData';
import { useSelection } from './hooks/useSelection';
import { useColumnManager } from './hooks/useColumnManager';
import { useDownloads } from './hooks/useDownloads';
import { useSearch } from './hooks/useSearch';
import { useSort } from './hooks/useSort';
import { useDelete } from './hooks/useDelete';
import TableHeader from './TableHeader';
import TableBody from './TableBody';
import DownloadPanel from './DownloadPanel';
import ActionBar from './ActionBar';
import Toast from '../Toast';

export default function TorrentTable({ apiKey }) {
  const [toast, setToast] = useState(null);
  const { torrents, loading, setTorrents, fetchTorrents } = useTorrentData(apiKey);
  const { search, setSearch, filteredTorrents } = useSearch(torrents);
  const { sortField, sortDirection, handleSort, sortTorrents } = useSort();
  const { 
    selectedItems, 
    handleSelectAll, 
    handleFileSelect, 
    hasSelectedFiles,
    hasSelectedFilesForTorrent,
    setSelectedItems 
  } = useSelection();
  const { activeColumns, handleColumnChange } = useColumnManager();
  const {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks
  } = useDownloads(apiKey);

  const { 
    isDeleting, 
    deleteTorrent, 
    handleBulkDelete 
  } = useDelete(apiKey, setTorrents, setSelectedItems, setToast, fetchTorrents);

  const [statusFilter, setStatusFilter] = useState('all');

  const handleStatusChange = (value) => {
    // Don't parse if it's 'all' or already an object
    setStatusFilter(value === 'all' ? value : 
      typeof value === 'string' ? JSON.parse(value) : value);
  };

  const filteredByStatus = filteredTorrents.filter(torrent => {
    if (statusFilter === 'all') return true;
    
    const filter = statusFilter;

    // Check all conditions in the filter
    return Object.entries(filter).every(([key, value]) => {
      // Special handling for download_state arrays
      if (key === 'download_state') {
        const states = Array.isArray(value) ? value : [value];
        return states.some(state => 
          typeof state === 'string' && torrent.download_state?.includes(state)
        );
      }
      
      // Direct comparison for other properties
      return torrent[key] === value;
    });
  });

  const sortedTorrents = sortTorrents(filteredByStatus);

  if (loading && torrents.length === 0) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <DownloadPanel
        downloadLinks={downloadLinks}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        onDismiss={() => setDownloadLinks([])}
        setToast={setToast}
      />
      
      <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-4"></div>

      <ActionBar
        torrents={sortedTorrents}
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        hasSelectedFiles={hasSelectedFiles}
        activeColumns={activeColumns}
        onColumnChange={handleColumnChange}
        search={search}
        onSearch={setSearch}
        onStatusChange={handleStatusChange}
        isDownloading={isDownloading}
        onBulkDownload={() => handleBulkDownload(selectedItems)}
        isDeleting={isDeleting}
        onBulkDelete={() => handleBulkDelete(selectedItems)}
      />

      <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <TableHeader
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            onSelectAll={handleSelectAll}
            torrents={sortedTorrents}
            sortField={sortField}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <TableBody
            torrents={sortedTorrents}
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            onFileSelect={handleFileSelect}
            hasSelectedFilesForTorrent={hasSelectedFilesForTorrent}
            setSelectedItems={setSelectedItems}
            apiKey={apiKey}
            onTorrentDelete={deleteTorrent}
          />
        </table>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
} 