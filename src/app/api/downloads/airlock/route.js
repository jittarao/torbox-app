import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeError } from '@/utils/sanitizeError';
import {
  EDIT_CONFIG,
  buildEditPayload,
  findDownloadById,
  normalizeAssetType,
} from './airlockPayload';

export async function PUT(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const { assetType: rawAssetType, id, airlocked } = await request.json();
    const assetType = normalizeAssetType(rawAssetType);
    const config = EDIT_CONFIG[assetType];

    if (!config || id === undefined || id === null || typeof airlocked !== 'boolean') {
      return Response.json(
        { success: false, error: 'assetType, id, and airlocked are required' },
        { status: 400 }
      );
    }

    const headers = {
      Authorization: `Bearer ${auth.apiKey}`,
      'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

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

    const currentItem = findDownloadById(listData, id);
    if (!currentItem) {
      return Response.json({ success: false, error: 'Download not found' }, { status: 404 });
    }

    const editResponse = await torboxFetch(
      `${API_BASE}/${API_VERSION}${config.editEndpoint}`,
      {
        cache: 'no-store',
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildEditPayload(currentItem, config.idField, airlocked)),
      }
    );
    const editData = await safeJsonParse(editResponse);

    if (!editResponse.ok) {
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
    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
