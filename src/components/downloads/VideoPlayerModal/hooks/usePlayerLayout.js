import { useSyncExternalStore } from 'react';

/** @typedef {'portrait' | 'landscape'} PlayerFormFactor */

const ORIENTATION_QUERIES = {
  landscape: '(orientation: landscape)',
  shortLandscape: '(max-height: 500px) and (orientation: landscape)',
};

const listeners = new Set();
/** @type {Record<string, MediaQueryList> | null} */
let mql = null;

function ensureMql() {
  if (typeof window === 'undefined') return null;
  if (!mql) {
    mql = {};
    for (const [key, query] of Object.entries(ORIENTATION_QUERIES)) {
      mql[key] = window.matchMedia(query);
      mql[key].addEventListener('change', () => {
        for (const listener of listeners) {
          listener();
        }
      });
    }
  }
  return mql;
}

/**
 * Orientation within touch chrome (compact landscape bar vs portrait).
 * @returns {PlayerFormFactor}
 */
export function getPlayerFormFactor() {
  if (typeof window === 'undefined') return 'portrait';

  const queries = ensureMql();
  if (!queries) return 'portrait';

  if (queries.landscape.matches || queries.shortLandscape.matches) {
    return 'landscape';
  }
  return 'portrait';
}

function subscribe(onStoreChange) {
  ensureMql();
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getServerSnapshot() {
  return 'portrait';
}

/** @returns {PlayerFormFactor} */
export function usePlayerFormFactor() {
  return useSyncExternalStore(subscribe, getPlayerFormFactor, getServerSnapshot);
}
