import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { assertDestructiveAllowed, protectedResponse } from '@/app/api/lib/downloadProtectionGuard';
import {
  deleteDownloadItem,
  deleteDownloadItemErrorResponse,
  DELETE_CONFIG,
} from '@/app/api/lib/deleteDownloadItem';
import { runWithConcurrency } from '@/utils/runWithConcurrency';
import { sanitizeError } from '@/utils/sanitizeError';

const BULK_DELETE_MAX = 1000;
const CONCURRENT_DELETES = 3;

/**
 * POST /api/downloads/bulk-delete — assert protection once, then delete allowed IDs.
 * Body: { ids: (string|number)[], assetType: 'torrents'|'usenet'|'webdl' }
 */
export async function POST(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const rawIds = body?.ids;
    const assetType = body?.assetType || 'torrents';

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return Response.json(
        { success: false, error: 'ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!DELETE_CONFIG[assetType]) {
      return Response.json({ success: false, error: 'Invalid assetType' }, { status: 400 });
    }

    const ids = [...new Set(rawIds.map((id) => String(id)).filter(Boolean))];

    if (ids.length > BULK_DELETE_MAX) {
      return Response.json(
        { success: false, error: `ids array must not exceed ${BULK_DELETE_MAX} items` },
        { status: 400 }
      );
    }

    const protection = await assertDestructiveAllowed(auth.apiKey, ids, 'delete');

    if (protection.forbidden) {
      return protectedResponse(protection.blocked.length > 0 ? protection.blocked : ids);
    }

    const allowedSet = new Set(protection.allowed.map(String));
    const allowedIds = ids.filter((id) => allowedSet.has(String(id)));
    const blockedIds = ids.filter((id) => !allowedSet.has(String(id)));

    if (allowedIds.length === 0) {
      return protectedResponse(blockedIds);
    }

    const deletedIds = [];

    await runWithConcurrency(allowedIds, CONCURRENT_DELETES, async (id) => {
      const response = await deleteDownloadItem({
        apiKey: auth.apiKey,
        id,
        assetType,
        skipProtectionCheck: true,
      });

      if (response.ok) {
        deletedIds.push(id);
      }
    });

    return Response.json({
      success: true,
      deleted_ids: deletedIds,
      blocked_ids: blockedIds,
    });
  } catch (error) {
    console.error('[bulk-delete] Error:', error);
    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
