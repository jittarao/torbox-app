import { FETCH_TIMEOUT_MS } from '@/config/apiConstants';
import { DOWNLOAD_PROTECTED_CODE } from '@/config/downloadProtection';
import { deleteItemHelper, BULK_DELETE_FETCH_OPTIONS } from '@/utils/deleteHelpers';
import { runWithConcurrency } from '@/utils/runWithConcurrency';

const CONCURRENT_ARCHIVE_DELETES = 3;

function toArchivePayload(item) {
  return {
    torrent_id: String(item.id),
    hash: item.hash,
    tracker: item.tracker ?? null,
    name: item.name ?? null,
  };
}

/**
 * Persist archive metadata to TBM backend.
 * @returns {{ success: boolean, torrentIds?: string[], error?: string }}
 */
export async function archiveToBackend(apiKey, items) {
  if (!apiKey) {
    return { success: false, error: 'No API key provided' };
  }

  const valid = items.filter((item) => item?.id != null && item?.hash);
  if (valid.length === 0) {
    return { success: false, error: 'No valid torrents to archive (hash required)' };
  }

  try {
    if (valid.length === 1) {
      const item = valid[0];
      const response = await fetch('/api/archived-downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(toArchivePayload(item)),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        return { success: true, torrentIds: [String(item.id)] };
      }

      if (response.status === 409) {
        return { success: true, torrentIds: [String(item.id)] };
      }

      if (response.status === 403 && data.code === DOWNLOAD_PROTECTED_CODE) {
        return {
          success: false,
          error: data.error || 'Download is protected',
          code: data.code,
          blocked_ids: data.blocked_ids,
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to archive download',
      };
    }

    const response = await fetch('/api/archived-downloads/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        downloads: valid.map(toArchivePayload),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success) {
      if (response.status === 403 && data.code === DOWNLOAD_PROTECTED_CODE) {
        return {
          success: false,
          error: data.error || 'Download is protected',
          code: data.code,
          blocked_ids: data.blocked_ids,
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to bulk archive downloads',
      };
    }

    const torrentIds = (data.data?.torrentIds ?? []).map(String);
    const blockedIds = (data.data?.blocked_ids ?? []).map(String);
    return { success: true, torrentIds, blockedIds };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Archive metadata then remove torrent from TorBox.
 */
export async function archiveAndRemoveItem(item, apiKey) {
  const archiveResult = await archiveToBackend(apiKey, [item]);
  if (!archiveResult.success) {
    return { success: false, error: archiveResult.error };
  }

  const deleteResult = await deleteItemHelper(String(item.id), apiKey, 'torrents', {
    timeout: FETCH_TIMEOUT_MS,
  });

  if (!deleteResult.success) {
    return { success: false, error: deleteResult.error };
  }

  return { success: true, id: item.id };
}

/**
 * Bulk archive then remove from TorBox with limited concurrency.
 */
export async function batchArchiveAndRemove(items, apiKey) {
  const archiveResult = await archiveToBackend(apiKey, items);
  if (!archiveResult.success) {
    return { successfulIds: [], error: archiveResult.error };
  }

  const idSet = new Set(archiveResult.torrentIds);
  const toRemove = items.filter((item) => idSet.has(String(item.id)));
  const successfulIds = [];

  await runWithConcurrency(toRemove, CONCURRENT_ARCHIVE_DELETES, async (item) => {
    const result = await deleteItemHelper(
      String(item.id),
      apiKey,
      'torrents',
      BULK_DELETE_FETCH_OPTIONS
    );
    if (result.success) {
      successfulIds.push(item.id);
    }
  });

  return { successfulIds, error: null, blockedIds: archiveResult.blockedIds ?? [] };
}
