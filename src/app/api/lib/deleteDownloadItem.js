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
    mylistPath: '/api/torrents/mylist',
    queuedType: 'torrent',
    controlPath: '/api/torrents/controltorrent',
    idField: 'torrent_id',
  },
  usenet: {
    cacheType: 'usenet',
    mylistPath: '/api/usenet/mylist',
    queuedType: 'usenet',
    controlPath: '/api/usenet/controlusenetdownload',
    idField: 'usenet_id',
  },
  webdl: {
    cacheType: 'webdl',
    mylistPath: '/api/webdl/mylist',
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
 * Delete one download via TorBox control API.
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string|number} options.id
 * @param {'torrents'|'usenet'|'webdl'} [options.assetType='torrents']
 * @param {boolean} [options.skipProtectionCheck=false]
 * @returns {Promise<Response>}
 */
export async function deleteDownloadItem({
  apiKey,
  id,
  assetType = 'torrents',
  skipProtectionCheck = false,
}) {
  const config = DELETE_CONFIG[assetType] || DELETE_CONFIG.torrents;

  if (!skipProtectionCheck) {
    const blocked = await guardDestructiveOrRespond(apiKey, [id], 'delete');
    if (blocked) return blocked;
  }

  const headers = buildTorboxHeaders(apiKey);

  const [, queuedResponse] = await Promise.all([
    torboxFetch(`${API_BASE}/${API_VERSION}${config.mylistPath}?id=${id}`, {
      cache: 'no-store',
      headers,
    }),
    torboxFetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=${config.queuedType}`, {
      cache: 'no-store',
      headers,
    }),
  ]);

  const queuedData = await safeJsonParse(queuedResponse);
  const isQueued = queuedData.data?.some((item) => item.id === id);

  const endpoint = isQueued
    ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
    : `${API_BASE}/${API_VERSION}${config.controlPath}`;

  const body = isQueued
    ? JSON.stringify({
        queued_id: id,
        operation: 'delete',
        type: config.queuedType,
      })
    : JSON.stringify({
        [config.idField]: id,
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

  if (!response.ok) {
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
      { status: response.status }
    );
  }

  await patchCacheRemoveIds(apiKey, config.cacheType, [id]);

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
