import { useEffect } from 'react';
import { useBackendModeStore } from '@/store/backendModeStore';

/**
 * Hook to detect if backend is available and determine storage mode
 * Uses Zustand store for centralized state management
 * @returns {Object} { mode: 'local' | 'backend', isLoading: boolean, error: string | null }
 */
export const useBackendMode = () => {
  const mode = useBackendModeStore((s) => s.mode);
  const isLoading = useBackendModeStore((s) => s.isLoading);
  const error = useBackendModeStore((s) => s.error);
  const checkBackend = useBackendModeStore((s) => s.checkBackend);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return { mode, isLoading, error };
};
