'use client';

import { useCallback } from 'react';
import { useUserPresenceStore } from '@/store/userPresenceStore';
import { useUserPresence } from './useUserPresence';

/**
 * Mount once at app shell level to track tab/idle/desktop presence globally.
 */
export function useGlobalUserPresence(pollingPaused) {
  const notifyReEngaged = useCallback((immediateRefresh) => {
    useUserPresenceStore.getState().notifyReEngaged(immediateRefresh);
  }, []);

  const notifyDisengaged = useCallback(() => {
    useUserPresenceStore.getState().notifyDisengaged();
  }, []);

  useUserPresence({
    pollingPaused,
    onReEngaged: notifyReEngaged,
    onDisengaged: notifyDisengaged,
  });
}
