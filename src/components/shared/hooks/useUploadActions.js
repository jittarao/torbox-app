'use client';

import { isNonRetryableResponse } from '@/config/errors';
import { retryFetch } from '@/utils/retryFetch';
import { scheduleForceStartReconcile } from '@/store/downloadListReconcile';
import {
  controlTorrent as controlTorrentAction,
  controlQueuedItem as controlQueuedItemAction,
  resolveAssetTypeForItem,
  uploadItem as uploadItemAction,
} from '@/utils/uploadActions';

function reconcileAssetTypeForUpload(assetType) {
  if (assetType === 'usenet') return 'usenet';
  if (assetType === 'webdl') return 'webdl';
  return 'torrents';
}

export function useUploadActions(apiKey, queue) {
  const {
    items,
    setError,
    isUploading,
    setIsUploading,
    setProgress,
    updateItemStatus,
    globalOptions,
    webdlPassword,
    assetType,
  } = queue;

  const uploadItem = async (item) =>
    uploadItemAction(apiKey, item, { assetType, globalOptions, webdlPassword });

  const uploadItemsBatch = async (itemsToUpload) => {
    const batchEndpoint = '/api/uploads/batch';

    const uploads = await Promise.all(
      itemsToUpload.map(async (item) => {
        const itemAssetType = resolveAssetTypeForItem(item, assetType);
        const upload = {
          type: itemAssetType === 'torrents' ? 'torrent' : itemAssetType,
          upload_type:
            item.type === 'magnet' ? 'magnet' : typeof item.data === 'string' ? 'link' : 'file',
          name: item.name || 'Unknown',
        };

        if (upload.upload_type === 'file' && item.data instanceof File) {
          const bytes = new Uint8Array(await item.data.arrayBuffer());
          const chunkSize = 0x8000;
          let binary = '';
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
          }
          upload.file_data = btoa(binary);
          upload.filename = item.data.name;
        } else if (upload.upload_type === 'magnet' || upload.upload_type === 'link') {
          upload.url = item.data;
        }

        if (
          item.type === 'torrent' ||
          item.type === 'magnet' ||
          itemAssetType === 'torrents' ||
          upload.type === 'torrent'
        ) {
          upload.seed = item.seed ?? globalOptions.seed ?? 1;
          upload.allow_zip = item.allowZip ?? globalOptions.allowZip ?? true;
        }

        if (assetType === 'webdl' && webdlPassword) {
          upload.password = webdlPassword;
        }

        if (item.asQueued === true || item.asQueued === 'true') {
          upload.as_queued = true;
        }

        return upload;
      })
    );

    return retryFetch(batchEndpoint, {
      maxRetries: 1,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ uploads }),
      permanent: [(data) => isNonRetryableResponse(data)],
    });
  };

  const uploadItems = async () => {
    setIsUploading(true);
    const pendingItems = items.filter((item) => item.status === 'queued');
    setProgress({ current: 0, total: pendingItems.length });

    const itemIndexMap = new Map(items.map((item, i) => [item, i]));
    const getItemIndex = (item) => {
      let idx = itemIndexMap.get(item);
      if (idx === undefined) {
        idx = items.findIndex((x) => x === item);
      }
      return idx;
    };

    const BATCH_THRESHOLD = 10;
    let uploadedCount = 0;

    if (pendingItems.length >= BATCH_THRESHOLD) {
      pendingItems.forEach((item) => {
        const idx = getItemIndex(item);
        updateItemStatus(idx, 'processing');
      });

      const result = await uploadItemsBatch(pendingItems);
      const responseData = result.data?.data || result.data;
      const uploads = responseData?.uploads || [];
      const errors = responseData?.errors || [];

      if (result.success && uploads.length > 0) {
        uploadedCount = uploads.length;
        pendingItems.forEach((item, index) => {
          const idx = getItemIndex(item);
          if (uploads[index]) {
            updateItemStatus(idx, 'success');
          } else {
            const error = errors.find(
              (e) =>
                e.upload?.name === item.name ||
                e.index === index ||
                (e.upload && JSON.stringify(e.upload) === JSON.stringify(item))
            );
            updateItemStatus(idx, 'error', error?.error || 'Upload failed');
          }
        });

        setProgress({ current: uploads.length, total: pendingItems.length });
        setError(errors.length > 0 ? `${errors.length} upload(s) failed` : null);
      } else if (result.success) {
        const uploadMap = new Map();
        uploads.forEach((upload) => {
          const matchingItem = pendingItems.find((item) => item.name === upload.name);
          if (matchingItem) {
            uploadMap.set(matchingItem, upload);
          }
        });
        uploadedCount = uploadMap.size;

        pendingItems.forEach((item) => {
          const idx = getItemIndex(item);
          if (uploadMap.has(item)) {
            updateItemStatus(idx, 'success');
          } else {
            const error = errors.find((e) => e.upload?.name === item.name);
            updateItemStatus(idx, 'error', error?.error || 'Upload failed');
          }
        });

        setProgress({ current: uploads.length, total: pendingItems.length });
        setError(errors.length > 0 ? `${errors.length} upload(s) failed` : null);
      } else {
        pendingItems.forEach((item) => {
          const idx = items.findIndex((x) => x === item);
          updateItemStatus(idx, 'error', result.error || 'Batch upload failed');
        });
        setError(result.userMessage || result.error || 'Batch upload failed');
      }
    } else {
      const itemEntries = pendingItems.map((item) => ({
        item,
        idx: getItemIndex(item),
      }));

      itemEntries.forEach(({ idx }) => updateItemStatus(idx, 'processing'));

      const results = await Promise.allSettled(itemEntries.map(({ item }) => uploadItem(item)));

      let processedCount = 0;
      let firstError = null;

      results.forEach((r, i) => {
        const { idx } = itemEntries[i];
        if (r.status === 'fulfilled' && r.value.success) {
          updateItemStatus(idx, 'success');
          processedCount++;
          uploadedCount += 1;
        } else {
          const errMsg =
            r.status === 'rejected'
              ? r.reason?.message || 'Upload failed'
              : r.value.userMessage || r.value.error || 'Upload failed';
          updateItemStatus(idx, 'error', errMsg);
          if (!firstError) firstError = errMsg;
        }
      });

      setProgress({ current: processedCount, total: pendingItems.length });
      setError(firstError);
    }

    setIsUploading(false);

    if (uploadedCount > 0) {
      scheduleForceStartReconcile(reconcileAssetTypeForUpload(assetType));
    }
  };

  const controlQueuedItem = async (queuedId, operation) =>
    controlQueuedItemAction(apiKey, queuedId, operation, assetType);

  const controlTorrent = async (torrent_id, operation) =>
    controlTorrentAction(apiKey, torrent_id, operation);

  return {
    uploadItem,
    uploadItems,
    controlQueuedItem,
    controlTorrent,
  };
}
