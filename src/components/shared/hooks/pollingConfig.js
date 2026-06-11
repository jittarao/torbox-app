/** Shared polling and rate-limit configuration for download list refresh. */

export const POLLING_CONFIG = {
  /** Max API calls per asset type within the sliding window (independent per type) */
  maxCalls: 3,
  /** Sliding window for call counting (ms) */
  windowSizeMs: 10_000,
  /** Minimum gap between fetches for the same asset type (ms) */
  minIntervalBetweenCallsMs: 2_000,
  minIntervalByType: { torrents: 2_000, usenet: 2_000, webdl: 2_000 },
  /** Poll interval while tab is visible and refresh is not paused */
  activeIntervalMs: 15_000,
  /** Poll interval when disengaged without auto-start (legacy / tests) */
  inactiveIntervalMs: 60_000,
  /** Disengaged + auto-start + queued torrents: fill slots without hammering the API */
  autoStartQueuedIntervalMs: 120_000,
  /** Disengaged + auto-start + empty queue: watch for newly queued uploads */
  autoStartWatchIntervalMs: 15 * 60_000,
  /**
   * After tab hide or user idle, keep active-interval polling for this long, then stop
   * (unless auto-start has queued torrents).
   */
  engagementGracePeriodMs: 3 * 60_000,
  /** No pointer/keyboard activity for this long while tab is visible → treat as idle */
  userIdleThresholdMs: 2 * 60_000,
  /** Gap between sequential controlqueued start calls in one fill batch (ms) */
  autoStartBetweenStartsMs: 400,
  /** Re-attempt a queued id after this long if TorBox still reports it queued (ms) */
  autoStartProcessedTtlMs: 90_000,
  /** Stagger delay between asset types on All-tab poll ticks (ms) */
  allTabStaggerMs: 2_000,
  /** Debounce trailing window for SSE-driven torrent refetches (ms) */
  sseDebounceMs: 2_000,
  /** Wait for TorBox queue→list move before refetching after force start (ms) */
  forceStartReconcileDelayMs: 4_000,
  /** Coalesce rapid manual/bulk force starts into one refetch (ms) */
  forceStartReconcileDebounceMs: 2_000,
};
