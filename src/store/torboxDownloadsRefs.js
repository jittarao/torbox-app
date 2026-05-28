import { createDownloadFetchRateLimiter } from '@/components/shared/hooks/downloadFetchRateLimit';

/** Imperative refs for download sync (not Zustand state). */
export const deltaCursorRef = { current: { torrents: null, usenet: null, webdl: null } };
export const processedQueueIdsRef = { current: new Set() };
/** Active initial-fetch key: `${apiKey}:${viewType}` */
export const fetchInProgressKeyRef = { current: null };

export function getFetchInProgressKey(apiKey, viewType) {
  return `${apiKey || ''}:${viewType || 'torrents'}`;
}

export function isFetchInProgress(apiKey, viewType) {
  return fetchInProgressKeyRef.current === getFetchInProgressKey(apiKey, viewType);
}

export function beginFetchInProgress(apiKey, viewType) {
  fetchInProgressKeyRef.current = getFetchInProgressKey(apiKey, viewType);
}

export function endFetchInProgress(apiKey, viewType) {
  const key = getFetchInProgressKey(apiKey, viewType);
  if (fetchInProgressKeyRef.current === key) {
    fetchInProgressKeyRef.current = null;
  }
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

export function resetDownloadSyncRefs(apiKey) {
  prevApiKeyRef.current = apiKey;
  deltaCursorRef.current = { torrents: null, usenet: null, webdl: null };
  getRateLimiter().reset();
  processedQueueIdsRef.current = new Set();
  fetchInProgressKeyRef.current = null;
  lastAutoStartCheckRef.current = 0;
}
