'use client';
import { useState } from 'react';

export function useDelete(apiKey, setTorrents, setSelectedItems, setToast, fetchTorrents) {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteTorrent = async (id, shouldRefetch = true) => {
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
      if (!data.success) {
        throw new Error('Delete failed');
      }
      if (shouldRefetch) {
        fetchTorrents();
      }
      return id;
    } catch (error) {
      console.error('Error deleting torrent:', error);
      setToast('Failed to delete torrent');
      setTimeout(() => setToast(null), 3000);
      return null;
    }
  };

  const batchDelete = async (ids, batchSize = 5) => {
    const results = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id => deleteTorrent(id, false))
      );
      results.push(...batchResults);
      
      // If we have successful deletions in this batch, update the UI immediately
      const successfulIds = batchResults.filter(Boolean);
      if (successfulIds.length > 0) {
        setTorrents(prev => prev.filter(t => !successfulIds.includes(t.id)));
        setSelectedItems(prev => ({
          torrents: new Set([...prev.torrents].filter(id => !successfulIds.includes(id))),
          files: new Map([...prev.files].filter(([torrentId]) => !successfulIds.includes(torrentId)))
        }));
      }
    }
    // Fetch torrents once after all batches are done
    await fetchTorrents();
    return results;
  };

  const handleBulkDelete = async (selectedItems) => {
    if (!selectedItems.torrents.size) return;
    
    setIsDeleting(true);
    try {
      await batchDelete(Array.from(selectedItems.torrents));
    } catch (error) {
      console.error('Error in bulk delete:', error);
    }
    setIsDeleting(false);
  };

  return {
    isDeleting,
    deleteTorrent,
    handleBulkDelete
  };
} 