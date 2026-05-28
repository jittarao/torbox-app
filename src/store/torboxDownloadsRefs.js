import { createDownloadFetchRateLimiter } from '@/components/shared/hooks/downloadFetchRateLimit';

/** Imperative refs for download sync (not Zustand state). */
export const deltaCursorRef = { current: { torrents: null, usenet: null, webdl: null } };
export const processedQueueIdsRef = { current: new Set() };
export const fetchInProgressRef = { current: false };
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
  fetchInProgressRef.current = false;
  lastAutoStartCheckRef.current = 0;
}
