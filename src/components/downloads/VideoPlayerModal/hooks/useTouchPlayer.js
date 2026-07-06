import { useSyncExternalStore } from 'react';

/**
 * Primary input is touch (phones, tablets, touch laptops).
 * Uses pointer/hover media features — not viewport width — so iPad and Android
 * tablets get touch chrome even above 1024px.
 */
const TOUCH_QUERIES = {
  touchPrimary: '(hover: none) and (pointer: coarse)',
  anyCoarse: '(any-pointer: coarse)',
  finePointer: '(pointer: fine)',
};

const listeners = new Set();
/** @type {Record<string, MediaQueryList> | null} */
let mql = null;

function ensureMql() {
  if (typeof window === 'undefined') return null;
  if (!mql) {
    mql = {};
    for (const [key, query] of Object.entries(TOUCH_QUERIES)) {
      mql[key] = window.matchMedia(query);
      mql[key].addEventListener('change', () => {
        for (const listener of listeners) {
          listener();
        }
      });
    }
    window.addEventListener('orientationchange', notify);
    window.addEventListener('resize', notify);
  }
  return mql;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** @returns {boolean} */
export function getTouchPlayer() {
  if (typeof window === 'undefined') return false;

  const queries = ensureMql();
  if (!queries) return false;

  if (queries.touchPrimary.matches) return true;

  // Tablets that report coarse pointer without hover:none (some Android tablets)
  if (queries.anyCoarse.matches && !queries.finePointer.matches) return true;

  // iPad and similar: touch points without a fine primary pointer
  if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) {
    return !queries.finePointer.matches;
  }

  return false;
}

function subscribe(onStoreChange) {
  ensureMql();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && mql) {
      window.removeEventListener('orientationchange', notify);
      window.removeEventListener('resize', notify);
    }
  };
}

function getServerSnapshot() {
  return false;
}

export function useTouchPlayer() {
  return useSyncExternalStore(subscribe, getTouchPlayer, getServerSnapshot);
}
