'use client';
import { Icons } from './constants';
import { formatSize } from './utils/formatters';

export default function FileRow({
  torrent,
  selectedItems,
  onFileSelect,
  apiKey,
  activeColumns
}) {
  const requestFileDownloadLink = async (torrentId, fileId) => {
    try {
      const response = await fetch(`/api/torrents/download?torrent_id=${torrentId}&file_id=${fileId}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();
      if (data.success && data.data) {
        window.open(data.data, '_blank');
      }
    } catch (error) {
      console.error('Error requesting file download:', error);
    }
  };

  return (
    <>
      {torrent.files.map((file) => (
        <tr 
          key={`${torrent.id}-${file.id}`} 
          className="border-blue-100 dark:border-blue-900 bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
        >
          <td className="px-6 py-2 whitespace-nowrap">
            <input
              type="checkbox"
              checked={selectedItems.files.get(torrent.id)?.has(file.id) || false}
              disabled={selectedItems.torrents.has(torrent.id)}
              onChange={(e) => onFileSelect(torrent.id, file.id, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
          </td>
          <td className="pl-6 py-2" colSpan={activeColumns.length}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={file.name}>
                {file.short_name || file.name}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {formatSize(file.size || 0)}
              </span>
              {file.mimetype && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 whitespace-nowrap">
                  {file.mimetype}
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-2 whitespace-nowrap text-right">
            <button
              onClick={() => requestFileDownloadLink(torrent.id, file.id)}
              className="p-1.5 rounded-full text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
              title="Download File"
            >
              {Icons.download}
            </button>
          </td>
        </tr>
      ))}
    </>
  );
} 