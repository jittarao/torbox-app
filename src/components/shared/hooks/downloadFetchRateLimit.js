import { POLLING_CONFIG } from './pollingConfig';

const {
  maxCalls: MAX_CALLS,
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
 * Enforces POLLING_CONFIG per asset type (max calls + min gap), not a shared global bucket.
 */
export function createDownloadFetchRateLimiter() {
  /** @type {Record<string, { callTimestamps: number[], lastFetchTime: number, latestFetchId: number }>} */
  const byType = {};

  const getTypeState = (activeType) => {
    if (!byType[activeType]) {
      byType[activeType] = { callTimestamps: [], lastFetchTime: 0, latestFetchId: 0 };
    }
    return byType[activeType];
  };

  const prune = (now = Date.now()) => {
    for (const key of Object.keys(byType)) {
      const state = byType[key];
      state.callTimestamps = pruneTimestamps(state.callTimestamps, now);
    }
  };

  const wouldBlock = (activeType, additionalCalls = 1, now = Date.now(), { skipMinInterval = false } = {}) => {
    prune(now);

    const typeState = getTypeState(activeType);
    const minInterval = MIN_INTERVAL_BY_TYPE[activeType] || MIN_INTERVAL_BETWEEN_CALLS;
    if (
      !skipMinInterval &&
      additionalCalls === 1 &&
      now - typeState.lastFetchTime < minInterval
    ) {
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
      for (const key of Object.keys(byType)) {
        delete byType[key];
      }
    },

    /** @param {string} activeType */
    peekWouldBlock(activeType) {
      return wouldBlock(activeType, 1);
    },

    /**
     * Whether a manual refresh can run (1 call, or all types on the All tab).
     * @param {string} viewType
     */
    canManualRefresh(viewType) {
      if (viewType === 'all') {
        prune();
        return ASSET_TYPES.every((assetType) => !wouldBlock(assetType, 1));
      }
      return !wouldBlock(viewType, 1);
    },

    /**
     * Reserve one fetch slot synchronously. Returns fetch id or null if blocked.
     * @param {string} activeType
     * @param {{ forMutation?: boolean }} [options]
     */
    acquire(activeType, { forMutation = false } = {}) {
      const now = Date.now();
      if (wouldBlock(activeType, 1, now, { skipMinInterval: forMutation })) {
        return null;
      }

      const typeState = getTypeState(activeType);
      typeState.lastFetchTime = now;
      typeState.callTimestamps.push(now);
      typeState.latestFetchId += 1;
      return typeState.latestFetchId;
    },

    getLatestFetchId(activeType) {
      return getTypeState(activeType).latestFetchId;
    },
  };
};
