'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  checkBackendAvailability,
  getBackendModeSnapshot,
  getServerBackendModeSnapshot,
  subscribeBackendMode,
} from '@/utils/backendModeCache';

/**
 * Detects if the TorBox Manager backend is available.
 * @returns {{ mode: 'local' | 'backend', isLoading: boolean, error: string | null }}
 */
export function useBackendMode() {
  const snapshot = useSyncExternalStore(
    subscribeBackendMode,
    getBackendModeSnapshot,
    getServerBackendModeSnapshot
  );

  useEffect(() => {
    checkBackendAvailability();
  }, []);

  return {
    mode: snapshot.mode,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
  };
}
