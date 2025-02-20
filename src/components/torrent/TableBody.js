'use client';
import { Fragment, useState, useRef } from 'react';
import TorrentRow from './TorrentRow';
import FileRow from './FileRow';

export default function TableBody({
  torrents,
  activeColumns,
  selectedItems,
  onFileSelect,
  hasSelectedFilesForTorrent,
  setSelectedItems,
  apiKey,
  onTorrentDelete
}) {
  const [expandedTorrents, setExpandedTorrents] = useState(new Set());
  const [hoveredTorrent, setHoveredTorrent] = useState(null);
  // Shared ref for tracking last clicked torrent row index
  const lastClickedTorrentIndexRef = useRef(null);

  const toggleFiles = (torrentId) => {
    const newExpanded = new Set(expandedTorrents);
    if (newExpanded.has(torrentId)) {
      newExpanded.delete(torrentId);
    } else {
      newExpanded.add(torrentId);
    }
    setExpandedTorrents(newExpanded);
  };

  return (
    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {torrents.map((torrent, index) => (
        <Fragment key={torrent.id}>
          <TorrentRow
            torrent={torrent}
            activeColumns={activeColumns}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            hasSelectedFilesForTorrent={hasSelectedFilesForTorrent}
            hoveredTorrent={hoveredTorrent}
            setHoveredTorrent={setHoveredTorrent}
            expandedTorrents={expandedTorrents}
            toggleFiles={toggleFiles}
            apiKey={apiKey}
            onDelete={onTorrentDelete}
            // Pass new props for shift+click functionality
            rowIndex={index}
            torrents={torrents}
            lastClickedTorrentIndexRef={lastClickedTorrentIndexRef}
          />
          {expandedTorrents.has(torrent.id) && torrent.files && (
            <FileRow
              torrent={torrent}
              selectedItems={selectedItems}
              onFileSelect={onFileSelect}
              apiKey={apiKey}
              activeColumns={activeColumns}
            />
          )}
        </Fragment>
      ))}
    </tbody>
  );
} 