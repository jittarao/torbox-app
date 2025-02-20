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
      return data.success ? 
        { success: true, id } : 
        { success: false, error: data.detail };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const batchDelete = async (ids) => {
    const successfulIds = [];

    // Process in chunks
    for (let i = 0; i < ids.length; i += CONCURRENT_DELETES) {
      const chunk = ids.slice(i, i + CONCURRENT_DELETES);
      const chunkResults = await Promise.all(
        chunk.map(async (id) => {
          // Try delete with retries
          let retries = 0;
          while (retries < MAX_RETRIES) {
            const result = await deleteTorrent(id);
            
            if (result.success) {
              successfulIds.push(id);
              return true;
            }

            // If non-retryable error, fail immediately
            if (result.error?.includes('not found') || result.error?.includes('unauthorized')) {
              console.error(`Delete failed: ${result.error}`);
              setToast('Failed to delete torrent');
              return false;
            }
            
            retries++;
            if (retries < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
          
          // Max retries reached
          console.error(`Delete failed after ${MAX_RETRIES} attempts`);
          setToast('Failed to delete torrent');
          return false;
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

      // Stop if any delete failed after retries
      if (chunkResults.includes(false)) break;
    }

    // Fetch torrents once after all batches are done
    await fetchTorrents();
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