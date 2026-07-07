'use client';

import { useSyncExternalStore } from 'react';
import { MOBILE_MEDIA_QUERY } from '@/utils/responsiveBreakpoints';

const QUERY = MOBILE_MEDIA_QUERY;

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
