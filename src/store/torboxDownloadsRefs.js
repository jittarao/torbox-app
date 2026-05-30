import { createDownloadFetchRateLimiter } from '@/components/shared/hooks/downloadFetchRateLimit';

/** Imperative refs for download sync (not Zustand state). */
export const deltaCursorRef = { current: { torrents: null, usenet: null, webdl: null } };
export const processedQueueIdsRef = { current: new Set() };
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
export const lastAutoStartCheckRef = { current: 0 };

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
  processedQueueIdsRef.current = new Set();
  fetchInProgressKeysRef.current = new Set();
  lastAutoStartCheckRef.current = 0;
}
