import { NON_RETRYABLE_ERRORS } from '@/config/errors';
import { FETCH_TIMEOUT_MS } from '@/config/apiConstants';
import { retryFetch } from '@/utils/retryFetch';
import { runWithConcurrency } from '@/utils/runWithConcurrency';
import { getEndpointForAssetType } from '@/utils/apiEndpoints';

const CONCURRENT_DELETES = 3;

/** Bulk deletes: one attempt per item so a slow slot frees after at most FETCH_TIMEOUT_MS. */
const BULK_DELETE_FETCH_OPTIONS = {
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
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err)
          ) && data.error !== 'DATABASE_ERROR', // Allow retries for DATABASE_ERROR
      ],
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
  const successfulIds = [];

  try {
    await runWithConcurrency(ids, CONCURRENT_DELETES, async (id) => {
      const result = await deleteItemHelper(id, apiKey, assetType, BULK_DELETE_FETCH_OPTIONS);
      if (result.success) {
        successfulIds.push(id);
      }
    });

    return successfulIds;
  } catch (error) {
    return [];
  }
};
