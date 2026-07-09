import { isBackendDisabled } from '@/utils/backendCheck';
import { backendFetch } from '@/utils/backendRequest';
import { DOWNLOAD_PROTECTED_CODE, DOWNLOAD_PROTECTED_MESSAGE } from '@/config/downloadProtection';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export { DOWNLOAD_PROTECTED_CODE, DOWNLOAD_PROTECTED_MESSAGE };

/**
 * @param {string} apiKey
 * @param {Array<string|number>} downloadIds
 * @param {string} operation
 * @returns {Promise<{ allowed: string[], blocked: string[], forbidden?: boolean }>}
 */
export async function assertDestructiveAllowed(apiKey, downloadIds, operation) {
  const ids = [...new Set(downloadIds.map((id) => String(id)).filter(Boolean))];

  if (ids.length === 0) {
    return { allowed: [], blocked: [] };
  }

  if (isBackendDisabled()) {
    return { allowed: ids, blocked: [] };
  }

  const response = await backendFetch(`${BACKEND_URL}/api/downloads/protect/assert`, {
    apiKey,
    method: 'POST',
    body: {
      download_ids: ids,
      operation,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 403) {
    return {
      allowed: [],
      blocked: data.blocked_ids || ids,
      forbidden: true,
    };
  }

  if (!response.ok) {
    throw new Error(data.error || 'Failed to verify download protection');
  }

  return {
    allowed: (data.allowed || []).map(String),
    blocked: (data.blocked || []).map(String),
  };
}

/**
 * @param {string[]} blockedIds
 * @returns {Response}
 */
export function protectedResponse(blockedIds) {
  return Response.json(
    {
      success: false,
      error: DOWNLOAD_PROTECTED_MESSAGE,
      code: DOWNLOAD_PROTECTED_CODE,
      blocked_ids: blockedIds,
    },
    { status: 403 }
  );
}

/**
 * Assert protection for a destructive operation; return a 403 Response when blocked.
 * @param {string} apiKey
 * @param {Array<string|number>} downloadIds
 * @param {string} operation
 * @returns {Promise<Response | null>}
 */
export async function guardDestructiveOrRespond(apiKey, downloadIds, operation) {
  const protection = await assertDestructiveAllowed(apiKey, downloadIds, operation);
  if (protection.forbidden || protection.blocked.length > 0) {
    return protectedResponse(
      protection.blocked.length > 0 ? protection.blocked : downloadIds.map(String)
    );
  }
  return null;
}
