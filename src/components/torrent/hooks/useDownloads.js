import { useState } from 'react';

const CONCURRENT_DOWNLOADS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export function useDownloads(apiKey) {
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const requestDownloadLink = async (torrentId, options = {}) => {
    try {
      const params = new URLSearchParams({
        torrent_id: torrentId,
        ...(options.fileId !== undefined && options.fileId !== null ? { file_id: options.fileId } : { zip_link: 'true' })
      });

      const response = await fetch(`/api/torrents/download?${params}`, {
        headers: { 'x-api-key': apiKey }
      });
      const data = await response.json();
      
      if (data.success) {
        const id = options.fileId !== undefined && options.fileId !== null ? `${torrentId}-${options.fileId}` : torrentId;
        return { success: true, data: { id, url: data.data } };
      }
      return { success: false, error: data.detail };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const downloadSingle = async (id, options = {}) => {
    const result = await requestDownloadLink(id, options);
    if (result.success) {
      window.open(result.data.url, '_blank');
      return true;
    }
    return false;
  };

  const handleBulkDownload = async (selectedItems, torrents) => {
    const totalTorrents = selectedItems.torrents.size;
    const totalFiles = Array.from(selectedItems.files.entries()).reduce((acc, [_, files]) => acc + files.size, 0);
    const total = totalTorrents + totalFiles;
    
    if (total === 0) return;
    
    setIsDownloading(true);
    setDownloadLinks([]);
    setDownloadProgress({ current: 0, total });

    // Create array of all download tasks
    const downloadTasks = [
      ...Array.from(selectedItems.torrents).map(id => ({ 
        type: 'torrent',
        id,
        name: torrents.find(t => t.id === id)?.name || `Torrent ${id}`
      })),
      ...Array.from(selectedItems.files.entries()).flatMap(([torrentId, fileIds]) => {
        const torrent = torrents.find(t => t.id === torrentId);
        return Array.from(fileIds).map(fileId => ({ 
          type: 'file',
          torrentId,
          fileId,
          name: torrent?.files?.find(f => f.id === fileId)?.name || `File ${fileId}`
        }));
      })
    ];

    // Process in chunks
    for (let i = 0; i < downloadTasks.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = downloadTasks.slice(i, i + CONCURRENT_DOWNLOADS);
      const chunkResults = await Promise.all(
        chunk.map(async (task) => {
          // Try download with retries
          let retries = 0;
          while (retries < MAX_RETRIES) {
            const result = task.type === 'torrent' 
              ? await requestDownloadLink(task.id)
              : await requestDownloadLink(task.torrentId, { fileId: task.fileId });
            
            if (result.success) {
              setDownloadLinks(prev => [...prev, { ...result.data, name: task.name }]);
              setDownloadProgress(prev => ({ ...prev, current: prev.current + 1 }));
              return true;
            }

            // If non-retryable error, fail immediately
            if (result.error?.includes('not found') || result.error?.includes('unauthorized')) {
              console.error(`Download failed: ${result.error}`);
              return false;
            }
            
            retries++;
            if (retries < MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
          }
          
          // Max retries reached
          console.error(`Download failed after ${MAX_RETRIES} attempts`);
          return false;
        })
      );

      // Stop if any download failed after retries
      if (chunkResults.includes(false)) break;
    }
    
    setIsDownloading(false);
  };

  return {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks,
    downloadSingle,
  };
} 