'use client';
import { Icons } from './constants';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';

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
  onDelete,
  rowIndex,
  torrents,
  lastClickedTorrentIndexRef
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

  const handleTorrentSelection = (checked, isShiftKey = false) => {
    if (isShiftKey && typeof rowIndex === 'number' && lastClickedTorrentIndexRef.current !== null) {
      const start = Math.min(lastClickedTorrentIndexRef.current, rowIndex);
      const end = Math.max(lastClickedTorrentIndexRef.current, rowIndex);
      setSelectedItems(prev => {
        const newTorrents = new Set(prev.torrents);
        for (let i = start; i <= end; i++) {
          const t = torrents[i];
          if (checked) {
            newTorrents.add(t.id);
          } else {
            newTorrents.delete(t.id);
          }
        }
        return {
          torrents: newTorrents,
          files: prev.files
        };
      });
    } else {
      setSelectedItems(prev => {
        const newTorrents = new Set(prev.torrents);
        if (checked) {
          newTorrents.add(torrent.id);
        } else {
          newTorrents.delete(torrent.id);
        }
        return {
          torrents: newTorrents,
          files: prev.files
        };
      });
    }
    lastClickedTorrentIndexRef.current = rowIndex;
  };

  const renderCell = (columnId) => {
    switch (columnId) {
      case 'name':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap max-w-md relative">
            <div 
              className="text-sm text-primary-text dark:text-primary-text-dark truncate cursor-pointer"
              onMouseEnter={() => setHoveredTorrent(torrent.id)}
              onMouseLeave={() => setHoveredTorrent(null)}
            >
              {torrent.name || 'Unnamed Torrent'}
              {hoveredTorrent === torrent.id && torrent.name && (
                <div className="absolute z-10 left-0 top-full mt-2 p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-lg max-w-xl break-words whitespace-normal">
                  {torrent.name}
                </div>
              )}
            </div>
          </td>
        );
      case 'size':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {formatSize(torrent.size || 0)}
          </td>
        );
      case 'created_at':
      case 'updated_at':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 relative group">
            <div className="cursor-default">
              {torrent[columnId] ? (
                <>
                  <span>{timeAgo(torrent[columnId])}</span>
                  <div className="invisible group-hover:visible absolute z-10 left-0 top-full mt-2 p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-lg">
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
            <DownloadStateBadge torrent={torrent} />
          </td>
        );
      case 'progress':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
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
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {(torrent.ratio || 0).toFixed(2)}
          </td>
        );
      case 'download_speed':
      case 'upload_speed':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {formatSpeed(torrent[columnId])}
          </td>
        );
      case 'eta':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {formatEta(torrent.eta)}
          </td>
        );
      case 'id':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {torrent.id}
          </td>
        );
      case 'total_uploaded':
      case 'total_downloaded':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {formatSize(torrent[columnId] || 0)}
          </td>
        );
      case 'seeds':
      case 'peers':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {torrent[columnId] || 0}
          </td>
        );
      case 'file_count':
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {torrent.files.length}
          </td>
        );
      default:
        return (
          <td key={columnId} className="px-6 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            {torrent[columnId]}
          </td>
        );
    }
  };

  return (
    <tr 
      className={`${
        selectedItems.torrents.has(torrent.id) 
          ? 'bg-accent/5 hover:bg-accent/10 dark:bg-accent-dark/5 dark:hover:bg-accent-dark/10' 
          : 'hover:bg-surface-hover dark:hover:bg-surface-hover-dark'
      } transition-colors ${
        !hasSelectedFilesForTorrent(torrent.id, selectedItems.files) && 'cursor-pointer'
      }`}
      onMouseDown={(e) => {
        // Prevent text selection on shift+click
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        // Ignore clicks on buttons or if has selected files
        if (e.target.closest('button') || hasSelectedFilesForTorrent(torrent.id, selectedItems.files)) return;
        const isChecked = selectedItems.torrents.has(torrent.id);
        handleTorrentSelection(!isChecked, e.shiftKey);
      }}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={selectedItems.torrents.has(torrent.id)}
          disabled={hasSelectedFilesForTorrent(torrent.id, selectedItems.files)}
          onChange={(e) => handleTorrentSelection(e.target.checked, e.shiftKey)}
          style={{ pointerEvents: 'none' }}
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
      </td>
      {activeColumns.map(columnId => renderCell(columnId))}
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
        <button
          onClick={() => toggleFiles(torrent.id)}
          className="text-primary-text/70 dark:text-primary-text-dark/70 
            hover:text-accent dark:hover:text-accent-dark transition-colors"
          title={expandedTorrents.has(torrent.id) ? 'Hide Files' : 'See Files'}
        >
          {Icons.files}
        </button>
        <button
          onClick={() => requestDownloadLink(torrent.id)}
          className="text-accent dark:text-accent-dark 
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
          title="Download"
        >
          {Icons.download}
        </button>
        <button
          onClick={() => onDelete(torrent.id)}
          className="text-red-500 dark:text-red-400 
            hover:text-red-600 dark:hover:text-red-500 transition-colors"
          title="Delete"
        >
          {Icons.delete}
        </button>
      </td>
    </tr>
  );
} 