'use client';
import { Icons } from './constants';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';

export default function TorrentRow({
  torrent,
  activeColumns,
  selectedItems,
  setSelectedItems,
  hasSelectedFilesForTorrent,
  hoveredTorrent,
  setHoveredTorrent,
  expandedTorrents,
  toggleFiles,
  apiKey,
  onDelete
}) {
  const requestDownloadLink = async (id) => {
    try {
      const response = await fetch(`/api/torrents/download?torrent_id=${id}&zip_link=true`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();
      if (data.success && data.data) {
        window.open(data.data, '_blank');
      }
    } catch (error) {
      console.error('Error requesting download:', error);
    }
  };

  const renderCell = (columnId) => {
    switch (columnId) {
      case 'name':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap max-w-md relative">
            <div 
              className="text-sm text-gray-900 dark:text-gray-200 truncate cursor-pointer"
              onMouseEnter={() => setHoveredTorrent(torrent.id)}
              onMouseLeave={() => setHoveredTorrent(null)}
            >
              {torrent.name || 'Unnamed Torrent'}
              {hoveredTorrent === torrent.id && torrent.name && (
                <div className="absolute z-10 left-0 top-full mt-2 p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg max-w-xl break-words whitespace-normal dark:text-gray-200">
                  {torrent.name}
                </div>
              )}
            </div>
          </td>
        );
      case 'size':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {formatSize(torrent.size || 0)}
          </td>
        );
      case 'created_at':
      case 'updated_at':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 relative group">
            <div className="cursor-default">
              {torrent[columnId] ? (
                <>
                  <span>{timeAgo(torrent[columnId])}</span>
                  <div className="invisible group-hover:visible absolute z-10 left-0 top-full mt-2 p-2 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg dark:text-gray-200">
                    {formatDate(torrent[columnId])}
                  </div>
                </>
              ) : (
                'Unknown'
              )}
            </div>
          </td>
        );
      case 'download_state':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap">
            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
              ${torrent.download_state === 'completed' || torrent.download_state === 'cached' ? 
                'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 
                torrent.download_state === 'downloading' ? 
                'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 
                torrent.download_state === 'uploading' || torrent.download_state === 'uploading (no peers)' ?
                'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>
              {torrent.download_state === 'completed' || torrent.download_state === 'cached' ? 
                'Completed' :
                torrent.download_state === 'downloading' ?
                'Downloading' :
                torrent.download_state === 'uploading' || torrent.download_state === 'uploading (no peers)' ?
                'Uploading' :
                'Unknown'}
            </span>
          </td>
        );
      case 'progress':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${(torrent.progress || 0) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs">{((torrent.progress || 0) * 100).toFixed(1)}%</span>
          </td>
        );
      case 'ratio':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {(torrent.ratio || 0).toFixed(2)}
          </td>
        );
      case 'download_speed':
      case 'upload_speed':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {formatSpeed(torrent[columnId])}
          </td>
        );
      case 'eta':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {formatEta(torrent.eta)}
          </td>
        );
      case 'id':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {torrent.id}
          </td>
        );
      case 'total_uploaded':
      case 'total_downloaded':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {formatSize(torrent[columnId] || 0)}
          </td>
        );
      case 'seeds':
      case 'peers':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {torrent[columnId] || 0}
          </td>
        );
      default:
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {torrent[columnId]}
          </td>
        );
    }
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={selectedItems.torrents.has(torrent.id)}
          disabled={hasSelectedFilesForTorrent(torrent.id, selectedItems.files)}
          onChange={(e) => {
            setSelectedItems(prev => {
              const newTorrents = new Set(prev.torrents);
              if (e.target.checked) {
                newTorrents.add(torrent.id);
              } else {
                newTorrents.delete(torrent.id);
              }
              return {
                torrents: newTorrents,
                files: prev.files
              };
            });
          }}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
      </td>
      {activeColumns.map(columnId => renderCell(columnId))}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
        <button
          onClick={() => toggleFiles(torrent.id)}
          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 inline-flex items-center"
          title={expandedTorrents.has(torrent.id) ? 'Hide Files' : 'See Files'}
        >
          {Icons.files}
        </button>
        <button
          onClick={() => requestDownloadLink(torrent.id)}
          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 inline-flex items-center"
          title="Download"
        >
          {Icons.download}
        </button>
        <button
          onClick={() => onDelete(torrent.id)}
          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-200 inline-flex items-center"
          title="Delete"
        >
          {Icons.delete}
        </button>
      </td>
    </tr>
  );
} 