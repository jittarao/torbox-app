'use client';

import { useState } from 'react';
import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';

// Parallel downloads
const CONCURRENT_DOWNLOADS = 3;

/**
 * Parse SQLite datetime string as UTC
 * Backend stores UTC datetime strings in SQLite format "YYYY-MM-DD HH:MM:SS" without timezone info.
 * JavaScript's Date constructor interprets strings without timezone as local time.
 * This function converts SQLite format to ISO format with 'Z' suffix to ensure UTC parsing.
 * @param {string|null|undefined} dateString - UTC datetime string in SQLite or ISO format
 * @returns {Date} Date object parsed as UTC
 */
const parseUtcDate = (dateString) => {
  if (!dateString) {
    return new Date();
  }

  // If already in ISO format, ensure it has 'Z' for UTC
  if (dateString.includes('T')) {
    const utcDateString = dateString.endsWith('Z') ? dateString : `${dateString}Z`;
    return new Date(utcDateString);
  }

  // SQLite format "YYYY-MM-DD HH:MM:SS" - convert to ISO "YYYY-MM-DDTHH:MM:SSZ"
  const utcDateString = `${dateString.replace(' ', 'T')}Z`;
  return new Date(utcDateString);
};

const addToDownloadHistory = async (link, apiKey) => {
  // Only save to backend - no localStorage fallback to avoid dual sources of truth
  if (!apiKey) {
    console.warn('Cannot save link history: API key is required');
    return;
  }

  try {
    const response = await fetch('/api/link-history', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        item_id: link.itemId,
        file_id: link.fileId || null,
        url: link.url,
        asset_type: link.assetType,
        item_name: link.itemName || null,
        file_name: link.fileName || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error saving link history to backend:', errorData.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Error saving link history to backend:', error);
  }
};

// Sanitize filename by extracting the actual filename from folder/filename format
// and replacing invalid characters that can cause issues in URLs or file systems
const sanitizeFilename = (filename) => {
  if (!filename) return filename;
  // Split by / and use the last part (handles folder/filename.ext format from TorBox)
  const actualFilename = filename.split('/').pop();
  // Replace invalid filename characters with underscore (excluding / since we've already handled it)
  // This prevents issues with download managers that decode URLs and interpret special chars
  return actualFilename.replace(/[<>:"\\|?*\x00-\x1F]/g, '_');
};

export function useDownloads(
  apiKey,
  assetType = 'torrents',
  downloadHistory,
  fetchDownloadHistory
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
      case 'all':
        // For 'all' type, we'll need to determine the endpoint based on the item's assetType
        return '/api/torrents/download'; // Default fallback
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
      case 'all':
        // For 'all' type, we'll need to determine the ID field based on the item's assetType
        return 'torrent_id'; // Default fallback
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

  const requestDownloadLink = async (id, options = {}, idField = null, metadata = {}) => {
    if (!apiKey) return false;

    // For 'all' type, determine the actual asset type from metadata
    let actualAssetType = assetType;
    let actualEndpoint = getDownloadEndpoint();
    let actualIdField = idField || getIdField();

    if (assetType === 'all' && metadata.item) {
      actualAssetType = metadata.item.assetType || 'torrents';

      // Determine the correct endpoint and ID field based on the actual asset type
      switch (actualAssetType) {
        case 'usenet':
          actualEndpoint = '/api/usenet/download';
          actualIdField = 'usenet_id';
          break;
        case 'webdl':
          actualEndpoint = '/api/webdl/download';
          actualIdField = 'web_id';
          break;
        default:
          actualEndpoint = '/api/torrents/download';
          actualIdField = 'torrent_id';
      }
    }

    // Determine the ID field based on asset type if not explicitly provided
    if (!idField) {
      idField = actualIdField;
    }
    const fileId = options.fileId;

    // Check if the download already exists in the download history
    let existingDownload = null;

    if (fileId) {
      existingDownload = downloadHistory.find(
        (download) =>
          String(download.itemId) === String(id) &&
          String(download.fileId) === String(fileId) &&
          download.assetType === actualAssetType &&
          Math.abs(new Date().getTime() - parseUtcDate(download.generatedAt).getTime()) <=
            1000 * 60 * 60 * 3 // within 3 hours
      );
    } else {
      existingDownload = downloadHistory.find(
        (download) =>
          String(download.itemId) === String(id) &&
          download.assetType === actualAssetType &&
          !download.fileId &&
          Math.abs(new Date().getTime() - parseUtcDate(download.generatedAt).getTime()) <=
            1000 * 60 * 60 * 3 // within 3 hours
      );
    }

    if (existingDownload)
      return {
        success: true,
        data: { id: existingDownload.id, url: existingDownload.url },
      };

    const params = new URLSearchParams({
      [idField]: id,
      ...(fileId !== undefined && fileId !== null ? { file_id: fileId } : { zip_link: 'true' }),
    });

    const result = await retryFetch(`${actualEndpoint}?${params}`, {
      headers: { 'x-api-key': apiKey },
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ),
      ],
    });

    if (result.success) {
      const downloadUrl = extractDownloadUrl(result.data);
      if (downloadUrl) {
        const resultId = fileId !== undefined && fileId !== null ? `${id}-${fileId}` : id;

        // Extract just the names we need for display
        const itemName = metadata.item?.name || null;
        const fileName = fileId
          ? metadata.item?.files?.find((file) => file.id === fileId)?.short_name || null
          : null;

        // Store in backend
        const newDownloadHistory = {
          id: resultId,
          itemId: id,
          fileId: fileId || null,
          url: downloadUrl,
          assetType: actualAssetType,
          generatedAt: new Date().toISOString(),
          itemName,
          fileName,
        };
        await addToDownloadHistory(newDownloadHistory, apiKey);

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
    metadata = {}
  ) => {
    try {
      const result = await requestDownloadLink(id, options, idField, metadata);
      if (result.success) {
        // Determine filename with extension for download managers
        let filename = options.filename;
        if (!filename) {
          // Get filename from metadata
          const file = metadata.item?.files?.find((f) => f.id === options.fileId);
          filename = file?.name || `${options.fileId}.zip`;
        }

        // Sanitize filename to remove invalid characters (like forward slashes)
        // that can cause download managers to misinterpret the URL
        const sanitizedFilename = sanitizeFilename(filename);

        // Append filename parameter to URL
        const url = new URL(result.data.url);
        const encodedFilename = encodeURIComponent(sanitizedFilename);
        const separator = url.search ? '&' : '?';
        const urlWithFilename = `${url.toString()}${separator}filename=${encodedFilename}`;

        if (copyLink) {
          try {
            await navigator.clipboard.writeText(urlWithFilename);
          } catch (error) {
            if (error.name === 'NotAllowedError') {
              // Store URL and set up focus listener
              const handleFocus = async () => {
                try {
                  await navigator.clipboard.writeText(urlWithFilename);
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

        // Fetch updated history from backend after single download completes
        if (fetchDownloadHistory && apiKey) {
          fetchDownloadHistory(apiKey);
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
      0
    );
    const total = totalItems + totalFiles;

    if (total === 0) return;

    setIsDownloading(true);
    setDownloadLinks([]);
    setDownloadProgress({ current: 0, total });

    // Create array of all download tasks
    const downloadTasks = [
      ...Array.from(selectedItems.items).flatMap((id) => {
        const item = items.find((t) => t.id === id);
        if (item?.files?.length === 1) {
          // If there's exactly one file, create a file task
          return {
            type: 'file',
            itemId: id,
            fileId: item.files[0].id,
            name: item.files[0].name || `File ${item.files[0].id}`,
            metadata: {
              assetType,
              item,
            },
          };
        } else {
          // Otherwise, create an item task
          return {
            type: 'item',
            id,
            name:
              item?.name || `${assetType.charAt(0).toUpperCase() + assetType.slice(1, -1)} ${id}`,
            metadata: {
              assetType,
              item,
            },
          };
        }
      }),
      ...Array.from(selectedItems.files.entries()).flatMap(([itemId, fileIds]) => {
        const item = items.find((t) => t.id === itemId);
        return Array.from(fileIds).map((fileId) => ({
          type: 'file',
          itemId,
          fileId,
          name: item?.files?.find((f) => f.id === fileId)?.name || `File ${fileId}`,
          metadata: {
            assetType,
            item: {
              ...item,
              files: item.files.filter((f) => f.id === fileId), // Filter to include only the specific file
            },
          },
        }));
      }),
    ];

    // Process in chunks
    for (let i = 0; i < downloadTasks.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = downloadTasks.slice(i, i + CONCURRENT_DOWNLOADS);
      const chunkResults = await Promise.all(
        chunk.map(async (task) => {
          const result =
            task.type === 'item'
              ? await requestDownloadLink(task.id, {}, null, task.metadata)
              : await requestDownloadLink(
                  task.itemId,
                  {
                    fileId: task.fileId,
                  },
                  null,
                  task.metadata
                );

          if (result.success) {
            // Determine filename with extension for download managers
            const filename = task.type === 'item' ? `${task.name}.zip` : task.name;

            // Sanitize filename to remove invalid characters (like forward slashes)
            // that can cause download managers to misinterpret the URL
            const sanitizedFilename = sanitizeFilename(filename);

            // Append filename parameter to URL
            const url = new URL(result.data.url);
            const encodedFilename = encodeURIComponent(sanitizedFilename);
            const separator = url.search ? '&' : '?';
            const urlWithFilename = `${url.toString()}${separator}filename=${encodedFilename}`;

            setDownloadLinks((prev) => [
              ...prev,
              { ...result.data, url: urlWithFilename, name: task.name },
            ]);
            setDownloadProgress((prev) => ({
              ...prev,
              current: prev.current + 1,
            }));
            return true;
          }

          return false;
        })
      );

      // Stop if any download failed after retries
      if (chunkResults.includes(false)) break;
    }

    setIsDownloading(false);

    // Fetch updated history from backend after all bulk downloads complete
    if (fetchDownloadHistory && apiKey) {
      fetchDownloadHistory(apiKey);
    }
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
