import { useEffect } from 'react';
import { useBackendModeStore } from '@/store/backendModeStore';

/**
 * Hook to detect if backend is available and determine storage mode
 * Uses Zustand store for centralized state management
 * @returns {Object} { mode: 'local' | 'backend', isLoading: boolean, error: string | null }
 */
export const useBackendMode = () => {
  const { mode, isLoading, error, checkBackend } = useBackendModeStore();

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return { mode, isLoading, error };
};
