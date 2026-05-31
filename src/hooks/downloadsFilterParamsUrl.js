/** @type {Set<() => void>} */
const listeners = new Set();

/** Stable empty snapshot for SSR and initial hydration. */
const EMPTY_SEARCH_PARAMS = new URLSearchParams();

/**
 * Cached client snapshot. useSyncExternalStore compares snapshots with Object.is;
 * returning a new URLSearchParams on every read causes infinite re-renders (React #185).
 */
let cachedSearchString = null;
/** @type {URLSearchParams} */
let cachedSearchParams = EMPTY_SEARCH_PARAMS;

/** Subscribe to client URL search changes (history.replaceState, popstate, router.replace). */
export function subscribeDownloadsFilterSearchParams(listener) {
  listeners.add(listener);
  if (typeof window === 'undefined') {
    return () => listeners.delete(listener);
  }
  const onPopState = () => listener();
  window.addEventListener('popstate', onPopState);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', onPopState);
  };
}

export function notifyDownloadsFilterSearchParams() {
  listeners.forEach((listener) => listener());
}

export function getDownloadsFilterSearchParamsSnapshot() {
  if (typeof window === 'undefined') {
    return EMPTY_SEARCH_PARAMS;
  }

  const search = window.location.search;
  if (search === cachedSearchString) {
    return cachedSearchParams;
  }

  cachedSearchString = search;
  cachedSearchParams = search.length > 0 ? new URLSearchParams(search) : EMPTY_SEARCH_PARAMS;
  return cachedSearchParams;
}

/** @internal Test helper — reset module cache between tests. */
export function resetDownloadsFilterSearchParamsCacheForTests() {
  cachedSearchString = null;
  cachedSearchParams = EMPTY_SEARCH_PARAMS;
}
