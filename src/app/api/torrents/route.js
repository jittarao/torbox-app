import { isTorboxFetchTimeout, torboxFetch } from '@/app/api/lib/torboxFetch';
import { safeJsonParse } from '@/utils/safeJsonParse';
import {
  buildListSyncResponse,
  handleListSyncRequest,
  patchCacheRemoveIds,
} from '@/app/api/lib/downloadListSync';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { queueTorrentUpload } from '@/app/api/lib/queueTorrentUpload';
import { sanitizeError } from '@/utils/sanitizeError';
import { guardDestructiveOrRespond } from '@/app/api/lib/downloadProtectionGuard';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';

const CACHE_TYPE = 'torrents';

const CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Authorization, x-api-key',
};

// Get all torrents
export async function GET(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;
  const { searchParams } = new URL(request.url);
  const revRaw = searchParams.get('rev');
  const rev = revRaw != null && revRaw !== '' ? Number(revRaw) : null;
  const bypassCache = request.headers.get('bypass-cache') === 'true';
  const forceListSync = request.headers.get('x-force-list-sync') === 'true';

  try {
    const result = await handleListSyncRequest({
      apiKey,
      type: CACHE_TYPE,
      rev: Number.isInteger(rev) ? rev : null,
      bypassCache,
      forceListSync,
    });

    return buildListSyncResponse(result, CACHE_HEADERS);
  } catch (error) {
    console.error('Error fetching torrents:', error);

    if (isTorboxFetchTimeout(error)) {
      return Response.json({ success: false, error: sanitizeError(error) }, { status: 408 });
    }

    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// Create a new torrent (queued upload)
export async function POST(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;
  const { upload, response } = await queueTorrentUpload(request, apiKey, { allowLink: true });
  if (response) return response;

  return Response.json({
    success: true,
    message: 'Upload queued successfully',
    data: upload,
  });
}

// Delete a torrent
export async function DELETE(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;
  const { id } = await request.json();

  try {
    const blocked = await guardDestructiveOrRespond(apiKey, [id], 'delete');
    if (blocked) return blocked;

    const [torrentsResponse, queuedResponse] = await Promise.all([
      torboxFetch(`${API_BASE}/${API_VERSION}/api/torrents/mylist?id=${id}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
      torboxFetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
    ]);

    const [torrentsData, queuedData] = await Promise.all([
      safeJsonParse(torrentsResponse),
      safeJsonParse(queuedResponse),
    ]);

    const isQueued = queuedData.data?.some((item) => item.id === id);

    const endpoint = isQueued
      ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
      : `${API_BASE}/${API_VERSION}/api/torrents/controltorrent`;

    const body = isQueued
      ? JSON.stringify({
          queued_id: id,
          operation: 'delete',
          type: 'torrent',
        })
      : JSON.stringify({
          torrent_id: id,
          operation: 'delete',
        });

    const response = await torboxFetch(endpoint, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body,
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      console.error('[torrents DELETE] Upstream error:', {
        endpoint,
        id,
        isQueued,
        status: response.status,
        error: data.error,
        detail: data.detail,
      });
      return Response.json(
        {
          success: false,
          error: data.error || `API responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    await patchCacheRemoveIds(apiKey, CACHE_TYPE, [id]);

    return Response.json(data);
  } catch (error) {
    console.error('[torrents DELETE] Error:', error);
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
}
