/** Shared polling and rate-limit configuration for download list refresh. */

export const POLLING_CONFIG = {
  /** Max API calls per asset type within the sliding window */
  maxCalls: 3,
  /** Same limit applied across all asset types combined (manual refresh, polling, etc.) */
  globalMaxCalls: 3,
  /** Sliding window for call counting (ms) */
  windowSizeMs: 10_000,
  /** Minimum gap between fetches for the same asset type (ms) */
  minIntervalBetweenCallsMs: 2_000,
  minIntervalByType: { torrents: 2_000, usenet: 2_000, webdl: 2_000 },
  /** Poll interval while tab is visible and refresh is not paused */
  activeIntervalMs: 15_000,
  /** Poll interval while tab is hidden (grace period only) */
  inactiveIntervalMs: 60_000,
  /** Keep slow polling after tab hide for this long, then stop (ms) */
  hiddenGracePeriodMs: 3 * 60_000,
  /** Minimum time between auto-start control API calls (ms) */
  autoStartCheckIntervalMs: 30_000,
  /** Debounce trailing window for SSE-driven torrent refetches (ms) */
  sseDebounceMs: 2_000,
};
