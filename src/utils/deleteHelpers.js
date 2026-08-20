import { isNonRetryableResponse } from '@/config/errors';
import { FETCH_TIMEOUT_MS } from '@/config/apiConstants';
import { DOWNLOAD_PROTECTED_CODE, DOWNLOAD_PROTECTED_MESSAGE } from '@/config/downloadProtection';
import { retryFetch } from '@/utils/retryFetch';
import { runWithConcurrency } from '@/utils/runWithConcurrency';
import { getEndpointForAssetType } from '@/utils/apiEndpoints';
import { isQueuedItem } from '@/utils/utility';

const CONCURRENT_DELETES = 5;

/** Per-item deletes in a bulk selection: one attempt per id so a slow slot frees after FETCH_TIMEOUT_MS. */
export const BULK_DELETE_FETCH_OPTIONS = {
  maxRetries: 1,
  timeout: FETCH_TIMEOUT_MS,
};

/**
 * @param {object | null | undefined} item
 * @returns {{ id: string|number, queued: boolean } | null}
 */
export function deleteEntryFromItem(item) {
  if (item?.id == null) return null;
  return { id: item.id, queued: isQueuedItem(item) };
}

export const deleteItemHelper = async (id, apiKey, assetType = 'torrents', options = {}) => {
  if (!apiKey) return { success: false, error: 'No API key provided' };

  const { queued = false, ...fetchOptions } = options;

  try {
    const endpoint = getEndpointForAssetType(assetType);

    const result = await retryFetch(endpoint, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: { id, queued },
      timeout: FETCH_TIMEOUT_MS,
      permanent: [(data) => isNonRetryableResponse(data)],
      ...fetchOptions,
    });

    if (result.success) {
      return { success: true };
    }

    const error = result.error || 'Unknown error occurred';
    if (
      error.includes('403') ||
      result.userMessage?.includes(DOWNLOAD_PROTECTED_MESSAGE) ||
      result.code === DOWNLOAD_PROTECTED_CODE
    ) {
      return { success: false, error: DOWNLOAD_PROTECTED_MESSAGE, code: DOWNLOAD_PROTECTED_CODE };
    }

    throw new Error(error);
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete many downloads via per-item DELETE routes with bounded concurrency.
 * @param {Array<{ id: string|number, queued?: boolean }>} entries
 * @param {string} apiKey
 * @param {'torrents'|'usenet'|'webdl'} [assetType='torrents']
 * @param {{ onItemComplete?: (result: { id: string|number, success: boolean, error?: string }) => void, fetchOptions?: object }} [options]
 */
export const batchDeleteHelper = async (entries, apiKey, assetType = 'torrents', options = {}) => {
  if (!apiKey || entries.length === 0) return [];

  const { onItemComplete, fetchOptions = BULK_DELETE_FETCH_OPTIONS } = options;
  const successfulIds = [];

  await runWithConcurrency(entries, CONCURRENT_DELETES, async (entry) => {
    const { id, queued = false } = entry;
    const result = await deleteItemHelper(id, apiKey, assetType, { ...fetchOptions, queued });

    if (result.success) {
      successfulIds.push(id);
      onItemComplete?.({ id, success: true });
    } else {
      onItemComplete?.({ id, success: false, error: result.error });
    }
  });

  return successfulIds;
};
