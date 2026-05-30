import { createDownloadFetchRateLimiter } from '@/components/shared/hooks/downloadFetchRateLimit';

/**
 * Imperative refs for download-sync async flow.
 * These are intentionally module-level (not Zustand):
 *   1. AbortControllers are DOM APIs — not serializable, can't go in Zustand.
 *   2. Delta cursors & in-progress flags are read/written in deep async callbacks
 *      across multiple render cycles — ref semantics (no re-render) are correct.
 *   3. Rate limiter is a singleton utility instance, not state.
 * Moving them to Zustand would require getState()/setState() in every async path
 * without gaining re-render value (no component subscribes to these directly).
 */
export const deltaCursorRef = { current: { torrents: null, usenet: null, webdl: null } };
/** @type {{ current: Map<string|number, number> }} queued id → last start attempt timestamp */
export const processedQueueIdsRef = { current: new Map() };
/** Active initial-fetch keys: `${apiKey}:${viewType}` — supports concurrent fetches per view. */
export const fetchInProgressKeysRef = { current: new Set() };

export function getFetchInProgressKey(apiKey, viewType) {
  return `${apiKey || ''}:${viewType || 'torrents'}`;
}

export function isFetchInProgress(apiKey, viewType) {
  return fetchInProgressKeysRef.current.has(getFetchInProgressKey(apiKey, viewType));
}

export function beginFetchInProgress(apiKey, viewType) {
  fetchInProgressKeysRef.current.add(getFetchInProgressKey(apiKey, viewType));
}

export function endFetchInProgress(apiKey, viewType) {
  fetchInProgressKeysRef.current.delete(getFetchInProgressKey(apiKey, viewType));
}

export const prevApiKeyRef = { current: null };

/** @type {{ current: import('@/components/shared/hooks/downloadFetchRateLimit').ReturnType<typeof createDownloadFetchRateLimiter> | null }} */
export const rateLimiterRef = { current: null };

export function getRateLimiter() {
  if (!rateLimiterRef.current) {
    rateLimiterRef.current = createDownloadFetchRateLimiter();
  }
  return rateLimiterRef.current;
}

/** Per-asset-type AbortControllers to cancel stale in-flight fetches. */
export const fetchAbortControllers = { current: { torrents: null, usenet: null, webdl: null } };

export function abortStaleFetch(activeType) {
  const prev = fetchAbortControllers.current[activeType];
  if (prev) {
    prev.abort();
  }
  const controller = new AbortController();
  fetchAbortControllers.current[activeType] = controller;
  return controller.signal;
}

export function resetDownloadSyncRefs(apiKey) {
  prevApiKeyRef.current = apiKey;
  deltaCursorRef.current = { torrents: null, usenet: null, webdl: null };
  for (const type of Object.keys(fetchAbortControllers.current)) {
    const ctrl = fetchAbortControllers.current[type];
    if (ctrl) ctrl.abort();
    fetchAbortControllers.current[type] = null;
  }
  getRateLimiter().reset();
  processedQueueIdsRef.current = new Map();
  fetchInProgressKeysRef.current = new Set();
}
