import { create } from 'zustand';

let backendModeLoggedOnce = false;

/**
 * True when the app is using the TorBox Manager backend (not local-only mode).
 * Safe on the server: always false (no persisted backend mode during SSR).
 */
export function isBackendAvailable() {
  if (typeof window === 'undefined') return false;
  return useBackendModeStore.getState().mode === 'backend';
}

/**
 * Zustand store for backend mode state
 * Centralizes backend availability detection and avoids duplicate API calls
 */
export const useBackendModeStore = create((set, get) => ({
  mode: 'local',
  isLoading: true,
  error: null,
  isChecking: false, // Flag to prevent concurrent API calls
  hasChecked: false, // Flag to track if we've already checked (prevents duplicate calls)

  checkBackend: async () => {
    const { isChecking, hasChecked } = get();

    // Prevent concurrent API calls
    if (isChecking) {
      return;
    }

    // If we've already checked, skip (prevents duplicate calls on page navigation)
    if (hasChecked) {
      return;
    }

    try {
      set({ isChecking: true, isLoading: true, error: null });

      const response = await fetch('/api/backend/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const detectedMode = data.available ? 'backend' : 'local';
        set({
          mode: detectedMode,
          isLoading: false,
          isChecking: false,
          hasChecked: true,
        });
      } else {
        set({
          mode: 'local',
          isLoading: false,
          isChecking: false,
          hasChecked: true,
        });
      }
    } catch (err) {
      // Only log once to avoid console spam
      if (typeof window !== 'undefined' && !backendModeLoggedOnce) {
        console.log('Backend not available, using local storage mode');
        backendModeLoggedOnce = true;
      }
      set({
        mode: 'local',
        error: err.message,
        isLoading: false,
        isChecking: false,
        hasChecked: true,
      });
    }
  },
}));
