import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { isTorboxFetchTimeout, torboxFetch } from '@/app/api/lib/torboxFetch';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeError } from '@/utils/sanitizeError';
import { AIRLOCK_LIMIT_REACHED_ERROR } from '@/config/errors';
import {
  EDIT_CONFIG,
  QUEUED_TYPE_BY_ASSET,
  buildEditPayload,
  findDownloadById,
  isIdInQueuedList,
  normalizeAssetType,
} from './airlockPayload';

function buildTorboxHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

function isInvalidId(id) {
  if (id === undefined || id === null) return true;
  if (typeof id === 'string' && id.trim() === '') return true;
  return false;
}

async function isDownloadQueued(apiKey, assetType, id, headers) {
  const queuedType = QUEUED_TYPE_BY_ASSET[assetType];
  if (!queuedType) return false;

  const queuedResponse = await torboxFetch(
    `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=${queuedType}&bypass_cache=true&_t=${Date.now()}`,
    {
      cache: 'no-store',
      headers,
    }
  );
  const queuedData = await safeJsonParse(queuedResponse);
  if (!queuedResponse.ok) {
    return false;
  }
  return isIdInQueuedList(queuedData, id);
}

export async function PUT(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const { assetType: rawAssetType, id, airlocked } = await request.json();
    const assetType = normalizeAssetType(rawAssetType);
    const config = EDIT_CONFIG[assetType];

    if (!config || isInvalidId(id) || typeof airlocked !== 'boolean') {
      return Response.json(
        { success: false, error: 'assetType, id, and airlocked are required' },
        { status: 400 }
      );
    }

    const headers = buildTorboxHeaders(auth.apiKey);

    if (await isDownloadQueued(auth.apiKey, assetType, id, headers)) {
      return Response.json(
        { success: false, error: 'Cannot update airlock for queued downloads' },
        { status: 400 }
      );
    }

    const listResponse = await torboxFetch(
      `${API_BASE}/${API_VERSION}${config.listEndpoint}?id=${encodeURIComponent(id)}&bypass_cache=true&_t=${Date.now()}`,
      {
        cache: 'no-store',
        headers,
      }
    );
    const listData = await safeJsonParse(listResponse);

    if (!listResponse.ok) {
      return Response.json(
        {
          success: false,
          error: listData.error || `API responded with status: ${listResponse.status}`,
          detail: listData.detail,
        },
        { status: listResponse.status }
      );
    }

    if (listData.success === false) {
      return Response.json(
        {
          success: false,
          error: listData.error || 'Failed to fetch download from TorBox',
          detail: listData.detail,
        },
        { status: 502 }
      );
    }

    const currentItem = findDownloadById(listData, id);
    if (!currentItem) {
      return Response.json({ success: false, error: 'Download not found' }, { status: 404 });
    }

    const editResponse = await torboxFetch(`${API_BASE}/${API_VERSION}${config.editEndpoint}`, {
      cache: 'no-store',
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEditPayload(currentItem, config.idField, airlocked)),
    });
    const editData = await safeJsonParse(editResponse);

    if (!editResponse.ok) {
      console.error('[airlock PUT] Upstream edit error:', {
        assetType,
        id,
        status: editResponse.status,
        error: editData.error,
        detail: editData.detail,
      });

      // TorBox signals an exceeded Airlock storage quota with a 5xx + error
      // code. This is an expected business-rule failure, not a server error —
      // surface it as a 422 so clients can present a targeted message instead
      // of treating it as a generic 500.
      if (editData.error === AIRLOCK_LIMIT_REACHED_ERROR) {
        return Response.json(
          {
            success: false,
            error: AIRLOCK_LIMIT_REACHED_ERROR,
            detail:
              editData.detail ||
              'You have reached your Airlock storage limit. Remove some Airlocked downloads or upgrade your plan to add more.',
          },
          { status: 422 }
        );
      }

      return Response.json(
        {
          success: false,
          error: editData.error || `API responded with status: ${editResponse.status}`,
          detail: editData.detail,
        },
        { status: editResponse.status }
      );
    }

    return Response.json(editData);
  } catch (error) {
    if (isTorboxFetchTimeout(error)) {
      return Response.json({ success: false, error: sanitizeError(error) }, { status: 408 });
    }

    console.error('[airlock PUT] Unexpected error:', error);
    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
