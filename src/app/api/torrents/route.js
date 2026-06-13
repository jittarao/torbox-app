import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { isTorboxFetchTimeout, torboxFetch } from '@/app/api/lib/torboxFetch';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getCached, setCached, computeDelta } from '@/app/api/lib/deltaListCache';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { queueTorrentUpload } from '@/app/api/lib/queueTorrentUpload';
import { sanitizeError } from '@/utils/sanitizeError';
const CACHE_TYPE = 'torrents';

// Get all torrents
export async function GET(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;
  const { searchParams } = new URL(request.url);
  const delta = searchParams.get('delta') === '1';
  const cursor = searchParams.get('cursor');

  try {
    // Add timestamp to force cache bypass
    const timestamp = Date.now();

    // Fetch both regular and queued torrents in parallel with timeout

    const [torrentsResponse, queuedResponse] = await Promise.all([
      torboxFetch(
        `${API_BASE}/${API_VERSION}/api/torrents/mylist?bypass_cache=true&_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      ),
      torboxFetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent&bypass_cache=true&_t=${timestamp}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      ),
    ]);

    const [torrentsData, queuedData] = await Promise.all([
      torrentsResponse.json(),
      queuedResponse.json(),
    ]);

    // Merge the data
    const mergedData = {
      success: torrentsData.success && queuedData.success,
      data: [
        ...(torrentsData.data || []),
        ...(queuedData.data || []).map((item) => ({ ...item, status: 'queued' })),
      ],
    };

    const cacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      Vary: 'Authorization',
    };

    if (delta && cursor && apiKey) {
      const cached = getCached(apiKey, CACHE_TYPE);
      if (cached) {
        const deltaResult = computeDelta(cached.data, mergedData.data);
        const newCursor = setCached(apiKey, CACHE_TYPE, mergedData.data);
        const payload = {
          success: mergedData.success,
          delta: true,
          data: deltaResult.data,
          cursor: newCursor,
        };
        if (deltaResult.removed.length > 0) {
          payload.removed = deltaResult.removed;
        }
        return Response.json(payload, { headers: cacheHeaders });
      }
    }

    if (apiKey) {
      const newCursor = setCached(apiKey, CACHE_TYPE, mergedData.data);
      return Response.json({ ...mergedData, cursor: newCursor }, { headers: cacheHeaders });
    }
    return Response.json(mergedData, { headers: cacheHeaders });
  } catch (error) {
    console.error('Error fetching torrents:', error);

    // Handle timeout specifically
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
    // First, fetch the torrent data to determine if it's queued
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

    // Check if the torrent is in the queued list
    const isQueued = queuedData.data?.some((item) => item.id === id);

    // Use appropriate endpoint based on whether torrent is queued
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
