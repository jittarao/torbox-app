import { NON_RETRYABLE_ERRORS } from '@/components/constants';
import { retryFetch } from '@/utils/retryFetch';

// Parallel deletes
const CONCURRENT_DELETES = 3;

export const getDeleteEndpoint = (assetType = 'torrents') => {
  switch (assetType) {
    case 'usenet':
      return '/api/usenet';
    case 'webdl':
      return '/api/webdl';
    default:
      return '/api/torrents';
  }
};

export const deleteItemHelper = async (id, apiKey, assetType = 'torrents') => {
  if (!apiKey) return { success: false, error: 'No API key provided' };

  try {
    const endpoint = getDeleteEndpoint(assetType);

    const result = await retryFetch(endpoint, {
      method: 'DELETE',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: { id },
      permanent: [
        (data) =>
          Object.values(NON_RETRYABLE_ERRORS).some(
            (err) => data.error?.includes(err) || data.detail?.includes(err),
          ),
      ],
    });

    if (result.success) {
      return { success: true };
    }

    throw new Error(result.error);
  } catch (error) {
    console.error('Error deleting:', error);
    return { success: false, error: error.message };
  }
};

export const batchDeleteHelper = async (
  ids,
  apiKey,
  assetType = 'torrents',
) => {
  const successfulIds = [];

  try {
    // Process in chunks
    for (let i = 0; i < ids.length; i += CONCURRENT_DELETES) {
      const chunk = ids.slice(i, i + CONCURRENT_DELETES);
      const results = await Promise.all(
        chunk.map(async (id) => {
          const result = await deleteItemHelper(id, apiKey, assetType);
          if (result.success) {
            successfulIds.push(id);
          }
          return { id, ...result };
        }),
      );
    }

    return successfulIds;
  } catch (error) {
    console.error('Error in batch delete:', error);
    return [];
  }
};
