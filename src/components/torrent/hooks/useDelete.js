'use client';
import { useState } from 'react';

const CONCURRENT_DELETES = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export function useDelete(apiKey, setTorrents, setSelectedItems, setToast, fetchTorrents) {
  const [isDeleting, setIsDeleting] = useState(false);

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
      return data;
    } catch (error) {
      console.error('Error deleting torrent:', error);
      return { success: false, error: error.message };
    }
  };

  const batchDelete = async (ids) => {
    const successfulIds = [];

    // Process in chunks
    for (let i = 0; i < ids.length; i += CONCURRENT_DELETES) {
      const chunk = ids.slice(i, i + CONCURRENT_DELETES);
      await Promise.all(
        chunk.map(async (id) => {
          // Try delete with retries
          let retries = 0;
          while (retries < MAX_RETRIES) {
            const result = await deleteTorrent(id);
            
            if (result.success) {
              successfulIds.push(id);
              break;
            }

            // Log non-retryable errors but continue processing
            if (result.error?.includes('not found') || result.error?.includes('unauthorized')) {
              console.error(`Delete failed for torrent ${id}: ${result.error}`);
              setToast('Some torrents failed to delete');
              break;
            }
            
            retries++;
            if (retries < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
          
          // Max retries reached - log and continue
          if (retries === MAX_RETRIES) {
            console.error(`Delete failed for torrent ${id} after ${MAX_RETRIES} attempts`);
            setToast('Some torrents failed to delete');
          }
        })
      );

      // Update UI for successful deletes in this chunk
      if (successfulIds.length > 0) {
        setTorrents(prev => prev.filter(t => !successfulIds.includes(t.id)));
        setSelectedItems(prev => ({
          torrents: new Set([...prev.torrents].filter(id => !successfulIds.includes(id))),
          files: new Map([...prev.files].filter(([torrentId]) => !successfulIds.includes(torrentId)))
        }));
      }
    }

    // Fetch fresh data and update UI only after all deletes are complete
    await fetchTorrents(true);

    return successfulIds;
  };

  const handleBulkDelete = async (selectedItems) => {
    if (!selectedItems.torrents.size) return;
    
    setIsDeleting(true);
    try {
      await batchDelete(Array.from(selectedItems.torrents));
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setToast('Failed to delete torrents');
    }
    setIsDeleting(false);
    setTimeout(() => setToast(null), 3000);
  };

  return {
    isDeleting,
    deleteTorrent,
    handleBulkDelete
  };
} 