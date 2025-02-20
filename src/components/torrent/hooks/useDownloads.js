import { useState } from 'react';
import { retryFetch } from '../../../utils/retryFetch';

export function useDownloads(apiKey) {
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

  const requestDownloadLink = async (id) => {
    try {
      const data = await retryFetch(
        () => fetch(`/api/torrents/download?torrent_id=${id}&zip_link=true`, {
          headers: { 'x-api-key': apiKey }
        })
      );
      
      if (data.success) {
        return { id, url: data.data };
      }
    } catch (error) {
      console.error('Error requesting download:', error);
    }
    return null;
  };

  const requestFileDownloadLink = async (torrentId, fileId) => {
    try {
      const data = await retryFetch(
        () => fetch(`/api/torrents/download?torrent_id=${torrentId}&file_id=${fileId}`, {
          headers: { 'x-api-key': apiKey }
        })
      );
      
      if (data.success) {
        return { id: `${torrentId}-${fileId}`, url: data.data };
      }
    } catch (error) {
      console.error('Error requesting file download:', error);
    }
    return null;
  };

  const handleBulkDownload = async (selectedItems) => {
    const totalTorrents = selectedItems.torrents.size;
    const totalFiles = Array.from(selectedItems.files.entries()).reduce((acc, [_, files]) => acc + files.size, 0);
    const total = totalTorrents + totalFiles;
    
    if (total === 0) return;
    
    setIsDownloading(true);
    setDownloadLinks([]);
    setDownloadProgress({ current: 0, total });
    
    let current = 0;
    
    // Download selected torrents
    for (const id of selectedItems.torrents) {
      const result = await requestDownloadLink(id);
      if (result) {
        setDownloadLinks(prev => [...prev, result]);
      }
      current++;
      setDownloadProgress({ current, total });
    }
    
    // Download selected files
    for (const [torrentId, fileIds] of selectedItems.files.entries()) {
      for (const fileId of fileIds) {
        const result = await requestFileDownloadLink(torrentId, fileId);
        if (result) {
          setDownloadLinks(prev => [...prev, result]);
        }
        current++;
        setDownloadProgress({ current, total });
      }
    }
    
    setIsDownloading(false);
  };

  return {
    downloadLinks,
    isDownloading,
    downloadProgress,
    handleBulkDownload,
    setDownloadLinks
  };
} 