import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { patchCacheRemoveIds } from '@/app/api/lib/downloadListSync';
import { guardDestructiveOrRespond } from '@/app/api/lib/downloadProtectionGuard';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { logRouteError } from '@/utils/routeLog';
import { sanitizeError } from '@/utils/sanitizeError';

const DELETE_CONFIG = {
  torrents: {
    cacheType: 'torrents',
    queuedType: 'torrent',
    controlPath: '/api/torrents/controltorrent',
    idField: 'torrent_id',
  },
  usenet: {
    cacheType: 'usenet',
    queuedType: 'usenet',
    controlPath: '/api/usenet/controlusenetdownload',
    idField: 'usenet_id',
  },
  webdl: {
    cacheType: 'webdl',
    queuedType: 'webdl',
    controlPath: '/api/webdl/controlwebdownload',
    idField: 'webdl_id',
  },
};

function buildTorboxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
  };
}

/**
 * TorBox control APIs expect numeric ids. JSON/client paths sometimes pass strings.
 * @param {string|number} id
 * @returns {string|number}
 */
export function coerceTorboxDownloadId(id) {
  if (typeof id === 'number' && Number.isFinite(id)) return id;
  if (id === '' || id == null) return id;
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : id;
}

/**
 * Delete one download via TorBox control API.
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string|number} options.id
 * @param {'torrents'|'usenet'|'webdl'} [options.assetType='torrents']
 * @param {boolean} [options.queued=false] Client-known queue vs mylist routing (avoids getqueued).
 * @returns {Promise<Response>}
 */
export async function deleteDownloadItem({ apiKey, id, assetType = 'torrents', queued = false }) {
  const config = DELETE_CONFIG[assetType] || DELETE_CONFIG.torrents;
  const downloadId = coerceTorboxDownloadId(id);

  const blocked = await guardDestructiveOrRespond(apiKey, [downloadId], 'delete');
  if (blocked) return blocked;

  const headers = buildTorboxHeaders(apiKey);
  const isQueued = queued === true;

  const endpoint = isQueued
    ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
    : `${API_BASE}/${API_VERSION}${config.controlPath}`;

  const body = isQueued
    ? JSON.stringify({
        queued_id: downloadId,
        operation: 'delete',
        type: config.queuedType,
      })
    : JSON.stringify({
        [config.idField]: downloadId,
        operation: 'delete',
      });

  const response = await torboxFetch(endpoint, {
    cache: 'no-store',
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await safeJsonParse(response);

  if (!response.ok || data.success === false) {
    if (assetType === 'torrents') {
      logRouteError('[torrents DELETE] Upstream error', {
        error: data.error || `API responded with status: ${response.status}`,
        detail: data.detail,
      });
    }
    return Response.json(
      {
        success: false,
        error: data.error || `API responded with status: ${response.status}`,
        detail: data.detail,
      },
      { status: response.ok ? 200 : response.status }
    );
  }

  await patchCacheRemoveIds(apiKey, config.cacheType, [downloadId]);

  return Response.json(data);
}

export function deleteDownloadItemErrorResponse(error, assetType = 'torrents') {
  if (assetType === 'torrents') {
    logRouteError('[torrents DELETE] Error', error);
    return Response.json(
      {
        success: false,
        error:
          sanitizeError(error) ||
          'There was an unknown error deleting this torrent. Please try again later.',
        detail: 'DOWNLOAD_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
  return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
}

export { DELETE_CONFIG };
