import { create } from 'zustand';

/**
 * Zustand store for backend mode state
 * Centralizes backend availability detection and avoids duplicate API calls
 */
export const useBackendModeStore = create((set, get) => {
  // Initialize from sessionStorage if available
  let initialMode = 'local';
  let initialLoading = true;
  if (typeof window !== 'undefined') {
    const cachedMode = sessionStorage.getItem('torboxBackendMode');
    if (cachedMode) {
      initialMode = cachedMode;
      initialLoading = false;
    }
  }

  return {
    mode: initialMode,
    isLoading: initialLoading,
    error: null,
    isChecking: false, // Flag to prevent concurrent API calls
    hasChecked: false, // Flag to track if we've already checked in this session

    checkBackend: async () => {
      const { isChecking, hasChecked, mode: currentMode, isLoading: currentLoading } = get();

      // Prevent concurrent API calls
      if (isChecking) {
        return;
      }

      // If we've already checked in this session and have a valid mode, skip
      if (hasChecked && currentMode && !currentLoading) {
        return;
      }

      // Check if we already have a cached value in sessionStorage
      if (typeof window !== 'undefined') {
        const cachedMode = sessionStorage.getItem('torboxBackendMode');
        if (cachedMode) {
          // Only update if different to avoid unnecessary re-renders
          if (currentMode !== cachedMode || currentLoading) {
            set({ mode: cachedMode, isLoading: false, hasChecked: true });
          } else {
            set({ hasChecked: true });
          }
          return;
        }
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
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('torboxBackendMode', detectedMode);
          }
        } else {
          set({
            mode: 'local',
            isLoading: false,
            isChecking: false,
            hasChecked: true,
          });
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('torboxBackendMode', 'local');
          }
        }
      } catch (err) {
        // Only log once to avoid console spam
        if (typeof window !== 'undefined' && !window.backendModeLogged) {
          console.log('Backend not available, using local storage mode');
          window.backendModeLogged = true;
        }
        set({
          mode: 'local',
          error: err.message,
          isLoading: false,
          isChecking: false,
          hasChecked: true,
        });
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('torboxBackendMode', 'local');
        }
      }
    },
  };
});
