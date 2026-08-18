import { isNonRetryableResponse } from '@/config/errors';
import { FETCH_TIMEOUT_MS } from '@/config/apiConstants';
import { retryFetch } from '@/utils/retryFetch';
import { getEndpointForAssetType } from '@/utils/apiEndpoints';

/** Bulk deletes: one attempt per item so a slow slot frees after at most FETCH_TIMEOUT_MS. */
export const BULK_DELETE_FETCH_OPTIONS = {
  maxRetries: 1,
  timeout: FETCH_TIMEOUT_MS,
};

export const deleteItemHelper = async (id, apiKey, assetType = 'torrents', fetchOptions = {}) => {
  if (!apiKey) return { success: false, error: 'No API key provided' };

  try {
    const endpoint = getEndpointForAssetType(assetType);

    const result = await retryFetch(endpoint, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: { id },
      timeout: FETCH_TIMEOUT_MS,
      // Client/request faults only — TorBox *_ERROR codes (server faults) are retryable.
      permanent: [(data) => isNonRetryableResponse(data)],
      ...fetchOptions,
    });

    if (result.success) {
      return { success: true };
    }

    throw new Error(result.error || 'Unknown error occurred');
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const batchDeleteHelper = async (ids, apiKey, assetType = 'torrents') => {
  if (!apiKey || ids.length === 0) return [];

  try {
    const result = await retryFetch('/api/downloads/bulk-delete', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: { ids, assetType },
      timeout: FETCH_TIMEOUT_MS,
      maxRetries: 1,
      permanent: [(data) => isNonRetryableResponse(data)],
      ...BULK_DELETE_FETCH_OPTIONS,
    });

    if (result.success && Array.isArray(result.deleted_ids)) {
      return result.deleted_ids;
    }

    throw new Error(result.error || 'Bulk delete failed');
  } catch (error) {
    return [];
  }
};
