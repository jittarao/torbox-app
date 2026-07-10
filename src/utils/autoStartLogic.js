/** Pure auto-start helpers shared by the page and SharedWorker (keep public/auto-start-logic.js in sync). */

/** Whether a download row is in the TorBox queue (matches utility.js / backend torrentStatus.js). */
export function isQueuedItem(item) {
  if (!item) return false;
  if (item.status && String(item.status).toLowerCase() === 'queued') return true;
  return false;
}

/** API may return active as boolean, 1, or the string "true". */
export function isActiveDownload(item) {
  const value = item?.active;
  return value === true || value === 1 || value === 'true';
}

export function coerceAutoStartLimit(raw) {
  const limit = Number(raw);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 999) : 3;
}

/**
 * @param {Map<number|string, number>} processedMap
 * @param {object[]} items
 */
export function pruneProcessedIdsMap(processedMap, items) {
  const queuedIds = new Set();
  for (const item of items) {
    if (isQueuedItem(item) && item.id != null) {
      queuedIds.add(item.id);
    }
  }

  for (const id of processedMap.keys()) {
    if (!queuedIds.has(id)) {
      processedMap.delete(id);
    }
  }
}

/**
 * @param {Map<number|string, number>} processedMap
 * @param {number|string} id
 * @param {number} now
 * @param {number} ttlMs
 */
export function isRecentlyProcessed(processedMap, id, now, ttlMs) {
  const startedAt = processedMap.get(id);
  if (startedAt == null) return false;

  if (now - startedAt > ttlMs) {
    processedMap.delete(id);
    return false;
  }
  return true;
}

export function countActiveDownloads(items) {
  return items.filter(isActiveDownload).length;
}

export function countQueuedItems(items) {
  return items.filter(isQueuedItem).length;
}

/**
 * Decide which queued torrent ids to start.
 *
 * @param {object[]} items
 * @param {number} limit
 * @param {Map<number|string, number>} processedMap
 * @param {number} now
 * @param {number} processedTtlMs
 * @returns {{ slotsAvailable: number, activeCount: number, queuedCount: number, toStart: Array<number|string> }}
 */
export function computeAutoStartPlan(items, limit, processedMap, now, processedTtlMs) {
  const activeCount = countActiveDownloads(items);
  const queuedCount = countQueuedItems(items);
  const slotsAvailable = limit - activeCount;

  if (slotsAvailable <= 0) {
    return { slotsAvailable: 0, activeCount, queuedCount, toStart: [] };
  }

  const toStart = items
    .filter(isQueuedItem)
    .filter(
      (item) => item.id != null && !isRecentlyProcessed(processedMap, item.id, now, processedTtlMs)
    )
    .slice(0, slotsAvailable)
    .map((item) => item.id);

  return { slotsAvailable, activeCount, queuedCount, toStart };
}
