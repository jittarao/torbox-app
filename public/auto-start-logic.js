// Keep in sync with src/utils/autoStartLogic.js (loaded by poll-worker via importScripts).

(function attachAutoStartLogic(root) {
  function isQueuedItem(item) {
    if (!item) return false;
    if (item.status && String(item.status).toLowerCase() === 'queued') return true;
    return false;
  }

  function isActiveDownload(item) {
    const value = item && item.active;
    return value === true || value === 1 || value === 'true';
  }

  function coerceAutoStartLimit(raw) {
    const limit = Number(raw);
    return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 999) : 3;
  }

  function pruneProcessedIdsMap(processedMap, items) {
    const queuedIds = new Set();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
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

  function isRecentlyProcessed(processedMap, id, now, ttlMs) {
    const startedAt = processedMap.get(id);
    if (startedAt == null) return false;

    if (now - startedAt > ttlMs) {
      processedMap.delete(id);
      return false;
    }
    return true;
  }

  function countActiveDownloads(items) {
    let count = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (isActiveDownload(items[i])) count += 1;
    }
    return count;
  }

  function countQueuedItems(items) {
    let count = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (isQueuedItem(items[i])) count += 1;
    }
    return count;
  }

  function computeAutoStartPlan(items, limit, processedMap, now, processedTtlMs) {
    const activeCount = countActiveDownloads(items);
    const queuedCount = countQueuedItems(items);
    const slotsAvailable = limit - activeCount;

    if (slotsAvailable <= 0) {
      return { slotsAvailable: 0, activeCount, queuedCount, toStart: [] };
    }

    const toStart = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!isQueuedItem(item) || item.id == null) continue;
      if (isRecentlyProcessed(processedMap, item.id, now, processedTtlMs)) continue;
      toStart.push(item.id);
      if (toStart.length >= slotsAvailable) break;
    }

    return { slotsAvailable, activeCount, queuedCount, toStart };
  }

  root.autoStartLogic = {
    isQueuedItem,
    isActiveDownload,
    coerceAutoStartLimit,
    pruneProcessedIdsMap,
    isRecentlyProcessed,
    countActiveDownloads,
    countQueuedItems,
    computeAutoStartPlan,
  };
})(typeof self !== 'undefined' ? self : globalThis);
