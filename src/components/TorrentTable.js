'use client';
import { useState, useEffect, useMemo } from 'react';

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
        body: JSON.stringify({ torrent_id: id })
      });
      const data = await response.json();
      if (data.success) {
        fetchTorrents();
      }
    } catch (error) {
      console.error('Error deleting torrent:', error);
    }
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

  if (loading && torrents.length === 0) return <div>Loading...</div>;

  console.log(filteredAndSortedTorrents);
  console.log(torrents);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 mt-4 justify-between">
        <input
          type="text"
          placeholder="Search torrents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="p-2 border rounded"
        />
        {/* <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2 border rounded"
        >
          {STATUS_FILTERS.map(status => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select> */}
        <div className="text-sm text-gray-500">
          Total torrents: {filteredAndSortedTorrents.length}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
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
              <tr key={torrent.key || torrent.id} className="hover:bg-gray-50">
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
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => deleteTorrent(torrent.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 