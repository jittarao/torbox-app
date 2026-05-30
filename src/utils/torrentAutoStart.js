import { controlQueuedItem } from '@/utils/uploadActions';
import { getAutoStartOptions, isActiveDownload, isQueuedItem } from '@/utils/utility';
import { processedQueueIdsRef } from '@/store/torboxDownloadsRefs';
import { POLLING_CONFIG } from '@/components/shared/hooks/pollingConfig';

const {
  autoStartBetweenStartsMs: BETWEEN_STARTS_MS,
  autoStartProcessedTtlMs: PROCESSED_TTL_MS,
} = POLLING_CONFIG;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function coerceAutoStartLimit(raw) {
  const limit = Number(raw);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 999) : 3;
}

/** Drop processed markers for torrents that left the queue. */
export function pruneProcessedQueueIds(items) {
  const queuedIds = new Set();
  for (const item of items) {
    if (isQueuedItem(item) && item.id != null) {
      queuedIds.add(item.id);
    }
  }

  const processed = processedQueueIdsRef.current;
  for (const id of processed.keys()) {
    if (!queuedIds.has(id)) {
      processed.delete(id);
    }
  }
}

function isRecentlyProcessed(id) {
  const processed = processedQueueIdsRef.current;
  const startedAt = processed.get(id);
  if (startedAt == null) return false;

  if (Date.now() - startedAt > PROCESSED_TTL_MS) {
    processed.delete(id);
    return false;
  }
  return true;
}

function markProcessed(id) {
  processedQueueIdsRef.current.set(id, Date.now());
}

/**
 * Start queued torrents until the active count reaches the user's limit.
 *
 * @param {object[]} items - Current torrent rows (post-merge)
 * @param {string} apiKey
 * @param {{ viewType?: string }} [options]
 * @returns {Promise<{ started: number, slotsAvailable: number }>}
 */
export async function fillAutoStartSlots(items, apiKey, { viewType = 'torrents' } = {}) {
  if (viewType !== 'torrents' && viewType !== 'all') {
    return { started: 0, slotsAvailable: 0 };
  }

  const uploadOptions = getAutoStartOptions();
  if (!uploadOptions?.autoStart || !apiKey) {
    return { started: 0, slotsAvailable: 0 };
  }

  pruneProcessedQueueIds(items);

  const limit = coerceAutoStartLimit(uploadOptions.autoStartLimit);
  const activeCount = items.filter(isActiveDownload).length;
  const slotsAvailable = limit - activeCount;

  if (slotsAvailable <= 0) {
    return { started: 0, slotsAvailable: 0 };
  }

  const candidates = items
    .filter(isQueuedItem)
    .filter((item) => item.id != null && !isRecentlyProcessed(item.id));

  const toStart = candidates.slice(0, slotsAvailable);
  let started = 0;

  for (let i = 0; i < toStart.length; i += 1) {
    const { id } = toStart[i];
    markProcessed(id);

    const result = await controlQueuedItem(apiKey, id, 'start', 'torrents');

    if (result?.success) {
      started += 1;
    } else {
      processedQueueIdsRef.current.delete(id);
    }

    if (i < toStart.length - 1) {
      await sleep(BETWEEN_STARTS_MS);
    }
  }

  return { started, slotsAvailable };
}
