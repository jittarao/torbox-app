'use client';

import { useState } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';

// Parallel downloads
const CONCURRENT_DOWNLOADS = 3;
const DOWNLOAD_HISTORY_KEY = 'torboxDownloadHistory';

// Helper to get/set localStorage
const getDownloadHistory = () => {
  const history = localStorage.getItem(DOWNLOAD_HISTORY_KEY);
  return history ? JSON.parse(history) : [];
};

const addToDownloadHistory = (link) => {
  const history = getDownloadHistory();
  history.unshift(link);
  localStorage.setItem(DOWNLOAD_HISTORY_KEY, JSON.stringify(history));
};

export function useDownloads(
  apiKey,
  assetType = 'torrents',
  downloadHistory,
  setDownloadHistory,
) {
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
  });

  const getDownloadEndpoint = () => {
    switch (assetType) {
      case 'usenet':
        return '/api/usenet/download';
      case 'webdl':
        return '/api/webdl/download';
      default:
        return '/api/torrents/download';
    }
  };

  const getIdField = () => {
    switch (assetType) {
      case 'usenet':
        return 'usenet_id';
      case 'webdl':
        return 'web_id';
      default:
        return 'torrent_id';
    }
  };

  const extractDownloadUrl = (data) => {
    // Handle different response formats from different API endpoints
    if (data.data) {
      return data.data; // Torrents and WebDL format
    } else if (data.download_url) {
      return data.download_url; // Usenet format
    }
    return null;
  };

  const requestDownloadLink = async (
    id,
    options = {},
    idField = null,
    metadata = {},
  ) => {
    if (!apiKey) return false;

    // Determine the ID field based on asset type if not explicitly provided
    if (!idField) {
      idField = getIdField();
    }

    const endpoint = getDownloadEndpoint();
    const fileId = options.fileId;

    // Check if the download already exists in the download history
    let existingDownload = null;

    if (fileId) {
      existingDownload = downloadHistory.find(
        (download) =>
          download.itemId === id &&
          download.fileId === fileId &&
          download.assetType === assetType &&
          Math.abs(
            new Date().getTime() - new Date(download.generatedAt).getTime(),
          ) <=
            1000 * 60 * 60 * 3, // within 3 hours
      );
    } else {
      existingDownload = downloadHistory.find(
        (download) =>
          download.itemId === id &&
          download.assetType === assetType &&
          !download.fileId &&
          Math.abs(
            new Date().getTime() - new Date(download.generatedAt).getTime(),
          ) <=
            1000 * 60 * 60 * 3, // within 3 hours
      );
    }

    if (existingDownload)
      return {
        success: true,
        data: { id: existingDownload.id, url: existingDownload.url },
      };

    const params = new URLSearchParams({
      [idField]: id,
      ...(fileId !== undefined && fileId !== null
        ? { file_id: fileId }
        : { zip_link: 'true' }),
    });

    const result = await retryFetch(`${endpoint}?${params}`, {
      headers: { 'x-api-key': apiKey },
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err),
          ),
      ],
    });

    if (result.success) {
      const downloadUrl = extractDownloadUrl(result.data);
      if (downloadUrl) {
        const resultId =
          fileId !== undefined && fileId !== null ? `${id}-${fileId}` : id;

        // Store in localStorage
        const newDownloadHistory = {
          id: resultId,
          itemId: id,
          fileId: fileId || null,
          url: downloadUrl,
          assetType,
          generatedAt: new Date().toISOString(),
          metadata,
        };
        addToDownloadHistory(newDownloadHistory);
        setDownloadHistory((prev) => [newDownloadHistory, ...prev]);

        return { success: true, data: { id: resultId, url: downloadUrl } };
      }
    }

    return {
      success: false,
      error: result.error || 'Unknown error',
    };
  };

  const downloadSingle = async (
    id,
    options = {},
    idField = null,
    copyLink = false,
    metadata = {},
  ) => {
    try {
      const result = await requestDownloadLink(id, options, idField, metadata);
      if (result.success) {
        if (copyLink) {
          try {
            await navigator.clipboard.writeText(result.data.url);
          } catch (error) {
            if (error.name === 'NotAllowedError') {
              // Store URL and set up focus listener
              const handleFocus = async () => {
                try {
                  await navigator.clipboard.writeText(result.data.url);
                  window.removeEventListener('focus', handleFocus);
                } catch (err) {
                  console.error('Error copying to clipboard on focus:', err);
                }
              };
              window.addEventListener('focus', handleFocus);
            } else {
              console.error('Clipboard error:', error);
            }
          }
        } else {
          window.open(result.data.url, '_blank');
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleBulkDownload = async (selectedItems, items) => {
    const totalItems = selectedItems.items.size;
    const totalFiles = Array.from(selectedItems.files.entries()).reduce(
      (acc, [_, files]) => acc + files.size,
      0,
    );
    const total = totalItems + totalFiles;

    if (total === 0) return;

    setIsDownloading(true);
    setDownloadLinks([]);
    setDownloadProgress({ current: 0, total });

    // Create array of all download tasks
    const downloadTasks = [
      ...Array.from(selectedItems.items).map((id) => ({
        type: 'item',
        id,
        name:
          items.find((t) => t.id === id)?.name ||
          `${assetType.charAt(0).toUpperCase() + assetType.slice(1, -1)} ${id}`,
      })),
      ...Array.from(selectedItems.files.entries()).flatMap(
        ([itemId, fileIds]) => {
          const item = items.find((t) => t.id === itemId);
          return Array.from(fileIds).map((fileId) => ({
            type: 'file',
            itemId,
            fileId,
            name:
              item?.files?.find((f) => f.id === fileId)?.name ||
              `File ${fileId}`,
          }));
        },
      ),
    ];

    // Process in chunks
    for (let i = 0; i < downloadTasks.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = downloadTasks.slice(i, i + CONCURRENT_DOWNLOADS);
      const chunkResults = await Promise.all(
        chunk.map(async (task) => {
          const metadata = {
            assetType,
            item: items.find((item) => item.id === task.id),
          };
          const result =
            task.type === 'item'
              ? await requestDownloadLink(task.id, {}, null, metadata)
              : await requestDownloadLink(
                  task.itemId,
                  {
                    fileId: task.fileId,
                  },
                  null,
                  metadata,
                );

          if (result.success) {
            setDownloadLinks((prev) => [
              ...prev,
              { ...result.data, name: task.name },
            ]);
            setDownloadProgress((prev) => ({
              ...prev,
              current: prev.current + 1,
            }));
            return true;
          }

          return false;
        }),
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
    downloadSingle,
    handleBulkDownload,
    setDownloadLinks,
  };
}
