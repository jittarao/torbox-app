import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';
import { getEndpointForAssetType } from '@/utils/apiEndpoints';

const DEFAULT_OPTIONS = {
  seed: 1,
  allowZip: true,
  asQueued: false,
};

function isPermanentError(data) {
  return Object.values(NON_RETRYABLE_ERRORS).some(
    (err) => data.error?.includes(err) || data.detail?.includes(err)
  );
}

/** Control queued items (start, etc.) without subscribing to uploader store. */
export async function controlQueuedItem(apiKey, queuedId, operation, assetType = 'torrents') {
  return retryFetch(`${getEndpointForAssetType(assetType)}/controlqueued`, {
    maxRetries: 1,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: {
      queued_id: queuedId,
      operation,
      type: assetType === 'torrents' ? 'torrent' : assetType,
    },
    permanent: [isPermanentError],
  });
}

/** Control active torrents (e.g. stop_seeding) without subscribing to uploader store. */
export async function controlTorrent(apiKey, torrent_id, operation) {
  return retryFetch('/api/torrents/control', {
    maxRetries: 1,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: {
      torrent_id,
      operation,
    },
    permanent: [isPermanentError],
  });
}

/**
 * Upload a single item (magnet, link, or file) via the TorBox API.
 * Used by archive restore and other one-off uploads outside the uploader queue UI.
 */
export async function uploadItem(
  apiKey,
  item,
  { assetType = 'torrents', globalOptions = DEFAULT_OPTIONS, webdlPassword = '' } = {}
) {
  const formData = new FormData();

  if (item.type === 'magnet') {
    formData.append('magnet', item.data);
  } else if (typeof item.data === 'string') {
    formData.append('link', item.data);
  } else {
    formData.append('file', item.data);
  }

  if (item.type === 'torrent' || item.type === 'magnet') {
    const seedValue = item.seed ?? globalOptions.seed ?? DEFAULT_OPTIONS.seed;
    const allowZipValue = item.allowZip ?? globalOptions.allowZip ?? DEFAULT_OPTIONS.allowZip;
    formData.append('seed', seedValue);
    formData.append('allow_zip', allowZipValue);
  }

  if (assetType === 'webdl' && webdlPassword) {
    formData.append('password', webdlPassword);
  }

  if (item.name) {
    formData.append('name', item.name);
  }

  if (item.asQueued === true || item.asQueued === 'true') {
    formData.append('as_queued', 'true');
  }

  const endpoint =
    item.type === 'magnet' || item.type === 'torrent'
      ? getEndpointForAssetType('torrents')
      : getEndpointForAssetType(assetType);

  return retryFetch(endpoint, {
    maxRetries: 1,
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: formData,
    permanent: [isPermanentError],
  });
}
