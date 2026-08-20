import { isTorboxFetchTimeout } from '@/app/api/lib/torboxFetch';
import { buildListSyncResponse, handleListSyncRequest } from '@/app/api/lib/downloadListSync';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { queueTorrentUpload } from '@/app/api/lib/queueTorrentUpload';
import { publicApiErrorResponse, sanitizeError } from '@/utils/sanitizeError';
import { logRouteError } from '@/utils/routeLog';
import {
  deleteDownloadItem,
  deleteDownloadItemErrorResponse,
} from '@/app/api/lib/deleteDownloadItem';

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
    logRouteError('Error fetching torrents', error);

    if (isTorboxFetchTimeout(error)) {
      return Response.json({ success: false, error: sanitizeError(error) }, { status: 408 });
    }

    const { body, status } = publicApiErrorResponse(error);
    return Response.json(body, { status });
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

  try {
    const { id, queued = false } = await request.json();
    return await deleteDownloadItem({ apiKey: auth.apiKey, id, assetType: 'torrents', queued });
  } catch (error) {
    return deleteDownloadItemErrorResponse(error, 'torrents');
  }
}
