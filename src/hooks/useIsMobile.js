'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

function getServerSnapshot() {
  return false;
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

let mediaQueryList = null;
const listeners = new Set();

function ensureMediaQueryList() {
  if (typeof window === 'undefined') return null;
  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia(QUERY);
    mediaQueryList.addEventListener('change', () => {
      for (const listener of listeners) {
        listener();
      }
    });
  }
  return mediaQueryList;
}

function subscribe(onStoreChange) {
  ensureMediaQueryList();
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
