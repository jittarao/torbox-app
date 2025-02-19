'use client';
import { useState, useEffect, useMemo, Fragment } from 'react';
import Toast from './Toast';

const SORT_FIELDS = {
  name: 'Name',
  size: 'Size',
  created_at: 'Added Date',
  download_state: 'Status',
  progress: 'Progress',
  ratio: 'Ratio'
};

const STATUS_FILTERS = [
  'all',
  'usenet_downloads',
  'download ready',
  'web downloads',
  'downloading',
  'uploading',
  'torrents',
  'inactive',
  'cached',
  'active'
];

export default function TorrentTable({ apiKey }) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hoveredTorrent, setHoveredTorrent] = useState(null);
  const [selectedItems, setSelectedItems] = useState({ torrents: new Set(), files: new Map() });
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [expandedTorrents, setExpandedTorrents] = useState(new Set());
  const [toast, setToast] = useState(null);

  const fetchTorrents = async () => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const response = await fetch('/api/torrents', {
        headers: {
          'x-api-key': apiKey
        }
      });
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setTorrents(data.data);
      } else {
        setTorrents([]);
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
      setTorrents([]);
    }
    setLoading(false);
  };

  const deleteTorrent = async (id) => {
    try {
      const response = await fetch('/api/torrents', {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          torrent_id: id,
          operation: 'delete'
        })
      });
      const data = await response.json();
      if (data.success) {
        fetchTorrents();
      }
    } catch (error) {
      console.error('Error deleting torrent:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedItems.torrents.size) return;
    
    setIsDeleting(true);
    try {
      for (const id of selectedItems.torrents) {
        await deleteTorrent(id);
      }
      setSelectedItems({ torrents: new Set(), files: new Map() });
    } catch (error) {
      console.error('Error in bulk delete:', error);
    }
    setIsDeleting(false);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedItems({
        torrents: new Set(filteredAndSortedTorrents.map(t => t.id)),
        files: new Map()
      });
    } else {
      setSelectedItems({ torrents: new Set(), files: new Map() });
    }
  };

  const handleFileSelect = (torrentId, fileId, checked) => {
    setSelectedItems(prev => {
      const newFiles = new Map(prev.files);
      if (!newFiles.has(torrentId)) {
        newFiles.set(torrentId, new Set());
      }
      
      if (checked) {
        newFiles.get(torrentId).add(fileId);
      } else {
        newFiles.get(torrentId).delete(fileId);
        if (newFiles.get(torrentId).size === 0) {
          newFiles.delete(torrentId);
        }
      }

      return {
        torrents: prev.torrents,
        files: newFiles
      };
    });
  };

  const requestDownloadLink = async (id) => {
    try {
      const response = await fetch(`/api/torrents/download?torrent_id=${id}&zip_link=true`,
        {
          headers: {
            'x-api-key': apiKey
          }
        }
      );
      const data = await response.json();
      if (data.success) {
        return { id, url: data.data };
      }
      return null;
    } catch (error) {
      console.error('Error requesting download:', error);
      return null;
    }
  };

  const handleBulkDownload = async () => {
    const totalTorrents = selectedItems.torrents.size;
    const totalFiles = Array.from(selectedItems.files.entries()).reduce((acc, [_, files]) => acc + files.size, 0);
    const total = totalTorrents + totalFiles;
    
    if (total === 0) return;
    
    setIsDownloading(true);
    setDownloadLinks([]);
    setDownloadProgress({ current: 0, total });
    
    let current = 0;
    
    // Download selected torrents
    for (const id of selectedItems.torrents) {
      const result = await requestDownloadLink(id);
      if (result) {
        setDownloadLinks(prev => [...prev, result]);
      }
      current++;
      setDownloadProgress({ current, total });
    }
    
    // Download selected files
    for (const [torrentId, fileIds] of selectedItems.files.entries()) {
      for (const fileId of fileIds) {
        const result = await requestFileDownloadLink(torrentId, fileId, true);
        if (result) {
          setDownloadLinks(prev => [...prev, result]);
        }
        current++;
        setDownloadProgress({ current, total });
      }
    }
    
    setIsDownloading(false);
  };

  const copyLinksToClipboard = () => {
    const text = downloadLinks.map(link => link.url).join('\n');
    navigator.clipboard.writeText(text)
      .then(() => {
        setToast('Links copied to clipboard!');
        setTimeout(() => setToast(null), 3000); // Hide toast after 3 seconds
      })
      .catch(err => {
        setToast('Failed to copy links');
        setTimeout(() => setToast(null), 3000);
      });
  };

  const toggleFiles = (torrentId) => {
    const newExpanded = new Set(expandedTorrents);
    if (newExpanded.has(torrentId)) {
      newExpanded.delete(torrentId);
    } else {
      newExpanded.add(torrentId);
    }
    setExpandedTorrents(newExpanded);
  };

  const requestFileDownloadLink = async (torrentId, fileId, returnUrl = false) => {
    try {
      const response = await fetch(`/api/torrents/download?torrent_id=${torrentId}&file_id=${fileId}`, {
        headers: {
          'x-api-key': apiKey
        }
      });
      const data = await response.json();
      if (data.success) {
        if (returnUrl) {
          return { id: `${torrentId}-${fileId}`, url: data.data };
        } else {
          window.open(data.data, '_blank');
        }
      }
    } catch (error) {
      console.error('Error requesting file download:', error);
    }
    return null;
  };

  useEffect(() => {
    fetchTorrents();
  }, [apiKey]);

  const formatSize = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedTorrents = useMemo(() => {
    return torrents
      .filter(torrent => {
        if (!torrent || typeof torrent !== 'object') return false;
        const matchesSearch = !search || (torrent.name && torrent.name.toLowerCase().includes(search.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || torrent.download_state === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (!a || !b) return 0;
        let comparison = 0;
        switch (sortField) {
          case 'size':
            comparison = (a.size || 0) - (b.size || 0);
            break;
          case 'progress':
            comparison = (a.progress || 0) - (b.progress || 0);
            break;
          case 'ratio':
            comparison = (a.ratio || 0) - (b.ratio || 0);
            break;
          default:
            comparison = (a[sortField] || '') < (b[sortField] || '') ? -1 : 1;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [torrents, search, sortField, sortDirection, statusFilter]);

  const hasSelectedFiles = () => {
    return Array.from(selectedItems.files.values()).some(files => files.size > 0);
  };

  if (loading && torrents.length === 0) return <div>Loading...</div>;

  console.log(filteredAndSortedTorrents);
  console.log(torrents);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 mt-4 justify-between">
        <div className="flex gap-4 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search torrents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="p-2 border rounded"
          />
          {selectedItems.torrents.size > 0 && !hasSelectedFiles() && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedItems.torrents.size})`}
            </button>
          )}
          {(selectedItems.torrents.size > 0 || hasSelectedFiles()) && (
            <button
              onClick={handleBulkDownload}
              disabled={isDownloading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isDownloading ? 'Fetching Links...' : 'Get Download Links'}
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          Total torrents: {filteredAndSortedTorrents.length}
        </div>
      </div>

      {(downloadLinks.length > 0 || isDownloading) && (
        <div className="mt-4 p-4 border rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-medium">
              Download Links
              {isDownloading && (
                <span className="text-sm text-gray-600 ml-2">
                  (Fetching {downloadProgress.current} of {downloadProgress.total})
                </span>
              )}
            </h3>
            {downloadLinks.length > 0 && (
              <button
                onClick={copyLinksToClipboard}
                className="text-blue-600 hover:text-blue-800"
              >
                Copy All Links
              </button>
            )}
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {downloadLinks.map(link => (
              <div key={link.id} className="flex items-center justify-between bg-white p-2 rounded">
                <span className="truncate mr-4">{link.url}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Download
                </a>
              </div>
            ))}
            {isDownloading && downloadLinks.length < downloadProgress.total && (
              <div className="text-sm text-gray-500 p-2 animate-pulse">
                Generating more links...
              </div>
            )}
          </div>
        </div>
      )}

      {isDownloading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
          ></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedItems.torrents.size === filteredAndSortedTorrents.length && filteredAndSortedTorrents.length > 0}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              {Object.entries(SORT_FIELDS).map(([field, label]) => (
                <th
                  key={field}
                  onClick={() => handleSort(field)}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  {label}
                  {sortField === field && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedTorrents.map((torrent) => (
              <Fragment key={torrent.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.torrents.has(torrent.id)}
                      onChange={(e) => {
                        setSelectedItems(prev => ({
                          torrents: new Set(prev.torrents),
                          files: prev.files
                        }));
                        if (e.target.checked) {
                          prev.torrents.add(torrent.id);
                        } else {
                          prev.torrents.delete(torrent.id);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap max-w-md relative">
                    <div 
                      className="text-sm text-gray-900 truncate cursor-pointer"
                      onMouseEnter={() => setHoveredTorrent(torrent.id)}
                      onMouseLeave={() => setHoveredTorrent(null)}
                    >
                      {torrent.name || 'Unnamed Torrent'}
                      {hoveredTorrent === torrent.id && torrent.name && (
                        <div className="absolute z-10 left-0 top-full mt-2 p-2 bg-white border rounded shadow-lg max-w-xl break-words whitespace-normal">
                          {torrent.name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatSize(torrent.size || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {torrent.created_at ? formatDate(torrent.created_at) : 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${torrent.download_state === 'completed' ? 'bg-green-100 text-green-800' : 
                        torrent.download_state === 'downloading' ? 'bg-blue-100 text-blue-800' : 
                        torrent.download_state === 'cached' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {torrent.download_state || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${(torrent.progress || 0) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs">{((torrent.progress || 0) * 100).toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(torrent.ratio || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button
                      onClick={() => toggleFiles(torrent.id)}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      {expandedTorrents.has(torrent.id) ? 'Hide Files' : 'See Files'}
                    </button>
                    <button
                      onClick={async () => {
                        const result = await requestDownloadLink(torrent.id);
                        if (result) {
                          window.open(result.url, '_blank');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => deleteTorrent(torrent.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {expandedTorrents.has(torrent.id) && torrent.files && torrent.files.map((file) => (
                  <tr key={`${torrent.id}-${file.id}`} className="bg-gray-50">
                    <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={selectedItems.files.get(torrent.id)?.has(file.id) || false}
                        onChange={(e) => handleFileSelect(torrent.id, file.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="pl-6 py-2 max-w-md" colSpan={2}>
                      <div className="flex items-center">
                        <span className="text-sm text-gray-600 truncate" title={file.name}>
                          {file.short_name || file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {formatSize(file.size || 0)}
                    </td>
                    <td colSpan={3} className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                      {file.mimetype}
                    </td>
                    <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => requestFileDownloadLink(torrent.id, file.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <Toast 
          message={toast} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
} 