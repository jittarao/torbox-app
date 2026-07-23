'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FETCH_TIMEOUT_MS } from '@/components/constants';
import { isNonRetryableResponse } from '@/config/errors';
import { retryFetch } from '@/utils/retryFetch';
import { runWithConcurrency } from '@/utils/runWithConcurrency';
import { buildSelectionIdMap } from '@/utils/downloadSelectionId';
import { resolveItemFiles } from '@/utils/downloadEntityFiles';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { parseUtcDate } from '@/utils/parseUtcDate';

// Parallel downloads
const CONCURRENT_DOWNLOADS = 3;

function metadataItemFiles(metadata) {
  const item = metadata?.item;
  if (!item) return [];
  if (item.files?.length) return item.files;
  return resolveItemFiles(item, useTorboxDownloadsStore.getState().filesByEntityKey);
}

const saveLinkHistoryToBackend = async (apiKey) => {
  const { ensureUserDb } = await import('@/utils/ensureUserDb');
  const dbReady = await ensureUserDb(apiKey);
  if (!dbReady.success) {
    console.warn('Cannot save link history: user database not ready', dbReady.error);
    return false;
  }
  return true;
};

const addToDownloadHistory = async (link, apiKey) => {
  // Only save to backend - no localStorage fallback to avoid dual sources of truth
  if (!apiKey) {
    console.warn('Cannot save link history: API key is required');
    return;
  }

  if (!(await saveLinkHistoryToBackend(apiKey))) {
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
        url: link.url || '',
        asset_type: link.assetType,
        item_name: link.itemName || null,
        file_name: link.fileName || null,
        status: link.status || 'success',
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

const addBulkToDownloadHistory = async (links, apiKey) => {
  // Bulk save to backend - used for bulk download operations
  if (!apiKey) {
    console.warn('Cannot save link history: API key is required');
    return;
  }

  if (!Array.isArray(links) || links.length === 0) {
    return;
  }

  if (!(await saveLinkHistoryToBackend(apiKey))) {
    return;
  }

  try {
    const entries = links.map((link) => ({
      item_id: link.itemId,
      file_id: link.fileId || null,
      url: link.url || '',
      asset_type: link.assetType,
      item_name: link.itemName || null,
      file_name: link.fileName || null,
      generated_at: link.generatedAt || new Date().toISOString(),
      status: link.status || 'success',
    }));

    const response = await fetch('/api/link-history/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ entries }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        'Error bulk saving link history to backend:',
        errorData.error || 'Unknown error'
      );
    }
  } catch (error) {
    console.error('Error bulk saving link history to backend:', error);
  }
};

// Sanitize filename by extracting the actual filename from folder/filename format
// and replacing invalid characters that can cause issues in URLs or file systems
/** Backend only accepts torrents | usenet | webdl — never "all". */
function resolveDownloadAssetType(assetType, metadata = {}) {
  if (assetType && assetType !== 'all') {
    return assetType;
  }
  const fromItem = metadata.item?.assetType || metadata.item?.asset_type;
  if (fromItem && fromItem !== 'all') {
    return fromItem;
  }
  const fromMeta = metadata.assetType || metadata.asset_type;
  if (fromMeta && fromMeta !== 'all') {
    return fromMeta;
  }
  return 'torrents';
}

const sanitizeFilename = (filename) => {
  if (!filename) return filename;
  // Split by / and use the last part (handles folder/filename.ext format from TorBox)
  const actualFilename = filename.split('/').pop();
  // Replace invalid filename characters with underscore (excluding / since we've already handled it)
  // This prevents issues with download managers that decode URLs and interpret special chars
  return actualFilename.replace(/[<>:"\\|?*\x00-\x1F]/g, '_');
};

function extractDownloadUrl(data) {
  // Handle different response formats from different API endpoints
  if (data.data) {
    return data.data; // Torrents and WebDL format
  } else if (data.download_url) {
    return data.download_url; // Usenet format
  }
  return null;
}

export function useDownloads(
  apiKey,
  assetType = 'torrents',
  downloadHistory,
  fetchDownloadHistory,
  onBulkComplete
) {
  const [downloadLinks, setDownloadLinks] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({
    current: 0,
    total: 0,
  });
  const focusCopyHandlerRef = useRef(null);
  const depsRef = useRef({
    downloadHistory,
    apiKey,
    assetType,
    fetchDownloadHistory,
    onBulkComplete,
  });
  useEffect(() => {
    depsRef.current = { downloadHistory, apiKey, assetType, fetchDownloadHistory, onBulkComplete };
  }, [downloadHistory, apiKey, assetType, fetchDownloadHistory, onBulkComplete]);

  useEffect(() => {
    return () => {
      if (focusCopyHandlerRef.current) {
        window.removeEventListener('focus', focusCopyHandlerRef.current);
        focusCopyHandlerRef.current = null;
      }
    };
  }, []);

  const getDownloadEndpoint = (type = depsRef.current.assetType) => {
    switch (type) {
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

  const getIdField = (type = depsRef.current.assetType) => {
    switch (type) {
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

  const requestDownloadLink = useCallback(
    async (id, options = {}, idField = null, metadata = {}, skipHistorySave = false) => {
      const { apiKey, assetType, downloadHistory, fetchDownloadHistory } = depsRef.current;

      if (!apiKey) return false;

      const actualAssetType = resolveDownloadAssetType(assetType, metadata);
      let actualEndpoint = getDownloadEndpoint(assetType);
      let actualIdField = idField || getIdField(assetType);

      if (assetType === 'all') {
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

      const isSuccessfulHistoryEntry = (download) =>
        download.status !== 'failed' &&
        Boolean(download.url) &&
        Math.abs(new Date().getTime() - parseUtcDate(download.generatedAt).getTime()) <=
          1000 * 60 * 60 * 3; // within 3 hours

      if (fileId) {
        existingDownload = downloadHistory.find(
          (download) =>
            String(download.itemId) === String(id) &&
            String(download.fileId) === String(fileId) &&
            download.assetType === actualAssetType &&
            isSuccessfulHistoryEntry(download)
        );
      } else {
        existingDownload = downloadHistory.find(
          (download) =>
            String(download.itemId) === String(id) &&
            download.assetType === actualAssetType &&
            !download.fileId &&
            isSuccessfulHistoryEntry(download)
        );
      }

      if (existingDownload) {
        return {
          success: true,
          data: { id: existingDownload.id, url: existingDownload.url },
          linkHistory: null,
        };
      }

      const params = new URLSearchParams({
        [idField]: id,
        ...(fileId !== undefined && fileId !== null ? { file_id: fileId } : { zip_link: 'true' }),
      });

      const result = await retryFetch(`${actualEndpoint}?${params}`, {
        maxRetries: 1,
        timeout: FETCH_TIMEOUT_MS,
        headers: { 'x-api-key': apiKey },
        permanent: [(data) => isNonRetryableResponse(data)],
      });

      if (result.success) {
        const downloadUrl = extractDownloadUrl(result.data);
        if (downloadUrl) {
          const resultId = fileId !== undefined && fileId !== null ? `${id}-${fileId}` : id;

          // Extract just the names we need for display
          const itemName = metadata.item?.name || null;
          const fileName = fileId
            ? metadataItemFiles(metadata).find((file) => file.id === fileId)?.short_name || null
            : null;

          // Prepare link history data
          const newDownloadHistory = {
            id: resultId,
            itemId: id,
            fileId: fileId || null,
            url: downloadUrl,
            assetType: actualAssetType,
            generatedAt: new Date().toISOString(),
            itemName,
            fileName,
            status: 'success',
          };

          // Only save immediately if not in bulk mode
          if (!skipHistorySave) {
            await addToDownloadHistory(newDownloadHistory, apiKey);
          }

          return {
            success: true,
            data: { id: resultId, url: downloadUrl },
            linkHistory: skipHistorySave ? newDownloadHistory : null, // Return link data for bulk save
          };
        }
      }

      const resultId = fileId !== undefined && fileId !== null ? `${id}-${fileId}` : id;
      const itemName = metadata.item?.name || null;
      const fileName = fileId
        ? metadataItemFiles(metadata).find((file) => file.id === fileId)?.short_name || null
        : null;

      const failedDownloadHistory = {
        id: resultId,
        itemId: id,
        fileId: fileId || null,
        url: null,
        assetType: actualAssetType,
        generatedAt: new Date().toISOString(),
        itemName,
        fileName,
        status: 'failed',
      };

      if (!skipHistorySave) {
        await addToDownloadHistory(failedDownloadHistory, apiKey);
      }

      return {
        success: false,
        error: result.error || 'Unknown error',
        linkHistory: skipHistorySave ? failedDownloadHistory : null,
      };
    },
    []
  );

  const downloadSingle = useCallback(
    async (id, options = {}, idField = null, copyLink = false, metadata = {}) => {
      const { apiKey, fetchDownloadHistory } = depsRef.current;

      try {
        const result = await requestDownloadLink(id, options, idField, metadata);
        if (result.success) {
          // Determine filename with extension for download managers
          let filename = options.filename;
          if (!filename) {
            // Get filename from metadata
            const file = metadataItemFiles(metadata).find((f) => f.id === options.fileId);
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
                if (focusCopyHandlerRef.current) {
                  window.removeEventListener('focus', focusCopyHandlerRef.current);
                }
                const handleFocus = async () => {
                  try {
                    await navigator.clipboard.writeText(urlWithFilename);
                  } catch (err) {
                    console.error('Error copying to clipboard on focus:', err);
                  } finally {
                    window.removeEventListener('focus', handleFocus);
                    if (focusCopyHandlerRef.current === handleFocus) {
                      focusCopyHandlerRef.current = null;
                    }
                  }
                };
                focusCopyHandlerRef.current = handleFocus;
                window.addEventListener('focus', handleFocus);
              } else {
                console.error('Clipboard error:', error);
              }
            }
          } else {
            window.open(result.data.url, '_blank', 'noopener');
          }

          // Fetch updated history from backend after single download completes
          if (fetchDownloadHistory && apiKey) {
            fetchDownloadHistory(apiKey);
          }

          return true;
        }

        if (fetchDownloadHistory && apiKey) {
          fetchDownloadHistory(apiKey);
        }
        return false;
      } catch (error) {
        console.error('Download error:', error);
      }
    },
    [requestDownloadLink]
  );

  const handleBulkDownload = useCallback(
    async (selectedItems, items) => {
      const { apiKey, assetType, fetchDownloadHistory, onBulkComplete } = depsRef.current;

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

      try {
        const itemSelectionMap = buildSelectionIdMap(items);
        const filesByEntityKey = useTorboxDownloadsStore.getState().filesByEntityKey;

        // Create array of all download tasks
        const downloadTasks = [
          ...Array.from(selectedItems.items).flatMap((selectionId) => {
            const item = itemSelectionMap.get(selectionId);
            const itemId = item?.id ?? selectionId;
            const taskAssetType = resolveDownloadAssetType(assetType, { item, assetType });
            const itemFiles = resolveItemFiles(item, filesByEntityKey);
            if (itemFiles.length === 1) {
              // If there's exactly one file, create a file task
              return {
                type: 'file',
                itemId,
                fileId: itemFiles[0].id,
                name: itemFiles[0].name || `File ${itemFiles[0].id}`,
                metadata: {
                  assetType: taskAssetType,
                  item: item ? { ...item, files: itemFiles } : item,
                },
              };
            } else {
              // Otherwise, create an item task
              return {
                type: 'item',
                id: itemId,
                name:
                  item?.name ||
                  `${assetType.charAt(0).toUpperCase() + assetType.slice(1, -1)} ${itemId}`,
                metadata: {
                  assetType: taskAssetType,
                  item,
                },
              };
            }
          }),
          ...Array.from(selectedItems.files.entries()).flatMap(([selectionId, fileIds]) => {
            const item = itemSelectionMap.get(selectionId);
            const itemId = item?.id ?? selectionId;
            const taskAssetType = resolveDownloadAssetType(assetType, { item, assetType });
            const itemFiles = resolveItemFiles(item, filesByEntityKey);
            return Array.from(fileIds).map((fileId) => ({
              type: 'file',
              itemId,
              fileId,
              name: itemFiles.find((f) => f.id === fileId)?.name || `File ${fileId}`,
              metadata: {
                assetType: taskAssetType,
                item: item
                  ? {
                      ...item,
                      files: itemFiles.filter((f) => f.id === fileId),
                    }
                  : undefined,
              },
            }));
          }),
        ];

        // Collect all link history entries for bulk save
        const linkHistoryEntries = [];
        const failures = [];

        const bumpProgress = () => {
          setDownloadProgress((prev) => ({
            ...prev,
            current: Math.min(prev.current + 1, prev.total),
          }));
        };

        // Bounded concurrency pool — slow/timed-out tasks do not block other slots
        await runWithConcurrency(downloadTasks, CONCURRENT_DOWNLOADS, async (task) => {
          try {
            const result =
              task.type === 'item'
                ? await requestDownloadLink(task.id, {}, null, task.metadata, true)
                : await requestDownloadLink(
                    task.itemId,
                    { fileId: task.fileId },
                    null,
                    task.metadata,
                    true
                  );

            if (result?.success) {
              const filename = task.type === 'item' ? `${task.name}.zip` : task.name;
              const sanitizedFilename = sanitizeFilename(filename);

              const url = new URL(result.data.url);
              const encodedFilename = encodeURIComponent(sanitizedFilename);
              const separator = url.search ? '&' : '?';
              const urlWithFilename = `${url.toString()}${separator}filename=${encodedFilename}`;

              setDownloadLinks((prev) => [
                ...prev,
                { ...result.data, url: urlWithFilename, name: task.name },
              ]);

              if (result.linkHistory) {
                linkHistoryEntries.push(result.linkHistory);
              }
              return;
            }

            if (result.linkHistory) {
              linkHistoryEntries.push(result.linkHistory);
            }

            failures.push({
              name: task.name,
              error: result?.error || 'Unknown error',
            });
          } catch (error) {
            console.error('Bulk download link error:', error);
            failures.push({
              name: task.name,
              error: error?.message || 'Unknown error',
            });
          } finally {
            bumpProgress();
          }
        });

        if (onBulkComplete) {
          onBulkComplete({
            succeeded: downloadTasks.length - failures.length,
            failed: failures.length,
            total: downloadTasks.length,
            failures,
          });
        }

        // Save all link history entries in bulk after all downloads complete
        if (linkHistoryEntries.length > 0 && apiKey) {
          await addBulkToDownloadHistory(linkHistoryEntries, apiKey);
        }

        // Fetch updated history from backend after all bulk downloads complete
        if (fetchDownloadHistory && apiKey) {
          fetchDownloadHistory(apiKey);
        }
      } finally {
        setIsDownloading(false);
      }
    },
    [requestDownloadLink]
  );

  return {
    downloadLinks,
    isDownloading,
    downloadProgress,
    downloadSingle,
    requestDownloadLink,
    handleBulkDownload,
    setDownloadLinks,
  };
}
