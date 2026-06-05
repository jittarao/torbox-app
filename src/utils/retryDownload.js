import { isInactiveOrFailed } from '@/components/downloads/ActionBar/utils/statusHelpers';
import { DEFAULT_UPLOAD_OPTIONS } from '@/components/shared/hooks/useUploadQueue';
import { resolveItemAssetType } from '@/store/torboxDownloadsSelectors';
import { uploadItem } from '@/utils/uploadActions';
import { getJSON } from '@/utils/storage';

export function buildShortMagnetLink({ hash, name }) {
  const encodedName = encodeURIComponent(name || 'Unknown');
  return `magnet:?xt=urn:btih:${hash}&dn=${encodedName}`;
}

function hasTorrentTracker(item) {
  const tracker = item?.tracker;
  return tracker != null && String(tracker).trim() !== '';
}

export function canRetryDownload(item, activeType) {
  if (!isInactiveOrFailed(item)) return false;

  const assetType = resolveItemAssetType(item, activeType);
  if (assetType === 'usenet') return false;
  if (assetType === 'webdl') return Boolean(item.original_url);
  if (assetType === 'torrents') {
    if (!hasTorrentTracker(item)) return false;
    return Boolean(item.hash) || Boolean(item.id);
  }

  return false;
}

function getUploadGlobalOptions() {
  const saved = getJSON('torrent-upload-options');
  return {
    seed: saved?.seed ?? DEFAULT_UPLOAD_OPTIONS.seed,
    allowZip: saved?.allowZip ?? DEFAULT_UPLOAD_OPTIONS.allowZip,
  };
}

async function resolveMagnetForTorrentRetry(apiKey, item) {
  if (item.hash) {
    return buildShortMagnetLink({ hash: item.hash, name: item.name });
  }

  const response = await fetch(`/api/torrents/export?torrent_id=${item.id}&type=magnet`, {
    headers: {
      'x-api-key': apiKey,
    },
  });
  const data = await response.json();

  if (data.success && data.data) {
    return data.data;
  }

  throw new Error(data.error || data.detail || 'Failed to export magnet link');
}

/**
 * Re-queue an inactive or failed torrent or web download via the upload pipeline.
 */
export async function retryDownload(apiKey, item, activeType) {
  if (!apiKey) {
    return { success: false, error: 'API key is required' };
  }

  const assetType = resolveItemAssetType(item, activeType);

  try {
    if (assetType === 'torrents') {
      const magnetLink = await resolveMagnetForTorrentRetry(apiKey, item);
      const result = await uploadItem(
        apiKey,
        {
          type: 'magnet',
          data: magnetLink,
          name: item.name,
        },
        {
          assetType: 'torrents',
          globalOptions: getUploadGlobalOptions(),
        }
      );

      if (!result?.success) {
        return {
          success: false,
          error: result?.error,
          userMessage: result?.userMessage || result?.error,
        };
      }

      return { success: true };
    }

    if (assetType === 'webdl') {
      if (!item.original_url) {
        return { success: false, error: 'source_url_unavailable' };
      }

      const result = await uploadItem(
        apiKey,
        {
          type: 'link',
          data: item.original_url,
          name: item.name,
        },
        { assetType: 'webdl' }
      );

      if (!result?.success) {
        return {
          success: false,
          error: result?.error,
          userMessage: result?.userMessage || result?.error,
        };
      }

      return { success: true };
    }

    return { success: false, error: 'unsupported_type' };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      userMessage: error.message,
    };
  }
}
