/** @type {Set<() => void>} */
const listeners = new Set();

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
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
}
