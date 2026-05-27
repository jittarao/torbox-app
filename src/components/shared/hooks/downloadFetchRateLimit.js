import { POLLING_CONFIG } from './pollingConfig';

const {
  maxCalls: MAX_CALLS,
  globalMaxCalls: GLOBAL_MAX_CALLS = MAX_CALLS,
  windowSizeMs: WINDOW_SIZE,
  minIntervalBetweenCallsMs: MIN_INTERVAL_BETWEEN_CALLS,
  minIntervalByType: MIN_INTERVAL_BY_TYPE,
} = POLLING_CONFIG;

const ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

function pruneTimestamps(timestamps, now = Date.now()) {
  return timestamps.filter((t) => now - t < WINDOW_SIZE).slice(-MAX_CALLS);
}

/**
 * Sliding-window rate limiter for download list API fetches.
 * Enforces POLLING_CONFIG: max 3 calls per 10s globally and per asset type,
 * plus minimum gap between calls to the same type.
 */
export function createDownloadFetchRateLimiter() {
  const globalTimestamps = [];
  /** @type {Record<string, { callTimestamps: number[], lastFetchTime: number, latestFetchId: number }>} */
  const byType = {};

  const getTypeState = (activeType) => {
    if (!byType[activeType]) {
      byType[activeType] = { callTimestamps: [], lastFetchTime: 0, latestFetchId: 0 };
    }
    return byType[activeType];
  };

  const prune = (now = Date.now()) => {
    const prunedGlobal = pruneTimestamps(globalTimestamps, now);
    globalTimestamps.length = 0;
    globalTimestamps.push(...prunedGlobal);

    for (const key of Object.keys(byType)) {
      const state = byType[key];
      state.callTimestamps = pruneTimestamps(state.callTimestamps, now);
    }
  };

  const wouldBlock = (activeType, additionalCalls = 1, now = Date.now()) => {
    prune(now);

    if (globalTimestamps.length + additionalCalls > GLOBAL_MAX_CALLS) {
      return true;
    }

    const typeState = getTypeState(activeType);
    const minInterval = MIN_INTERVAL_BY_TYPE[activeType] || MIN_INTERVAL_BETWEEN_CALLS;
    if (additionalCalls === 1 && now - typeState.lastFetchTime < minInterval) {
      return true;
    }

    if (typeState.callTimestamps.length + additionalCalls > MAX_CALLS) {
      return true;
    }

    return false;
  };

  return {
    prune,

    reset() {
      globalTimestamps.length = 0;
      for (const key of Object.keys(byType)) {
        delete byType[key];
      }
    },

    /** @param {string} activeType */
    peekWouldBlock(activeType) {
      return wouldBlock(activeType, 1);
    },

    /**
     * Whether a manual refresh can run (1 call, or 3 on the All tab).
     * @param {string} viewType
     */
    canManualRefresh(viewType) {
      const count = viewType === 'all' ? ASSET_TYPES.length : 1;
      if (viewType === 'all') {
        prune();
        if (globalTimestamps.length + count > GLOBAL_MAX_CALLS) {
          return false;
        }
        return ASSET_TYPES.every((assetType) => !wouldBlock(assetType, 1));
      }
      return !wouldBlock(viewType, 1);
    },

    /**
     * Reserve one fetch slot synchronously. Returns fetch id or null if blocked.
     * @param {string} activeType
     */
    acquire(activeType) {
      const now = Date.now();
      if (wouldBlock(activeType, 1, now)) {
        return null;
      }

      const typeState = getTypeState(activeType);
      typeState.lastFetchTime = now;
      typeState.callTimestamps.push(now);
      globalTimestamps.push(now);
      typeState.latestFetchId += 1;
      return typeState.latestFetchId;
    },

    getLatestFetchId(activeType) {
      return getTypeState(activeType).latestFetchId;
    },
  };
}
