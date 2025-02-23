'use client';
import { useState } from 'react';
import { Icons } from './constants';
import Spinner from '../shared/Spinner';
import { useDownloads } from './hooks/useDownloads';

export default function TorrentActions({ 
  torrent, 
  apiKey, 
  onDelete, 
  toggleFiles, 
  expandedTorrents,
  setTorrents,
  setSelectedItems 
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { downloadSingle } = useDownloads(apiKey);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadSingle(torrent.id);
    } finally {
      setIsDownloading(false);
    }
  };

  const forceStart = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch('/api/torrents/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          queued_id: torrent.id,
          operation: 'start',
          type: 'torrent'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to force start torrent');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await onDelete(torrent.id);
      if (result.success) {
        // Update UI immediately after successful deletion
        setTorrents(prev => prev.filter(t => t.id !== torrent.id));
        setSelectedItems(prev => ({
          torrents: new Set([...prev.torrents].filter(id => id !== torrent.id)),
          files: new Map([...prev.files].filter(([torrentId]) => torrentId !== torrent.id))
        }));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-x-4">
      {torrent.download_present && (
        <button
          onClick={() => toggleFiles(torrent.id)}
          className="text-primary-text/70 dark:text-primary-text-dark/70 
          hover:text-accent dark:hover:text-accent-dark transition-colors"
        title={expandedTorrents.has(torrent.id) ? 'Hide Files' : 'See Files'}
      >
          {Icons.files}
        </button>
      )}

      {!torrent.download_state && (
        <button
          onClick={() => forceStart(torrent.id)}
          disabled={isDownloading}
          className="stroke-2 text-accent dark:text-accent-dark 
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
          title="Force Start"
        >
          {isDownloading ? <Spinner size="sm" /> : Icons.play}
        </button>
      )}

      {torrent.download_present && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="text-accent dark:text-accent-dark 
            hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download"
        >
          {isDownloading ? <Spinner size="sm" /> : Icons.download}
        </button>
      )}

      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="text-red-500 dark:text-red-400 
          hover:text-red-600 dark:hover:text-red-500 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete"
      >
        {isDeleting ? <Spinner size="sm" /> : Icons.delete}
      </button>
    </div>
  );
} 