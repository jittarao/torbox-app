import { NextResponse } from 'next/server';
import { create } from 'zustand';
import { useEffect } from 'react';

/**
 * Check if backend is disabled via BACKEND_DISABLED environment variable
 * @returns {boolean} True if backend is disabled
 */
export function isBackendDisabled() {
  return process.env.BACKEND_DISABLED === 'true';
}

/**
 * Get a standardized response for when backend features are disabled
 * @param {string} message - Custom error message
 * @returns {NextResponse} 503 Service Unavailable response
 */
export function getBackendDisabledResponse(message = 'Backend features are disabled') {
  return NextResponse.json({ success: false, error: message }, { status: 503 });
}

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
    checkBackend: async () => {
      // Check if we already know the backend status
      if (typeof window !== 'undefined') {
        const cachedMode = sessionStorage.getItem('torboxBackendMode');
        if (cachedMode) {
          const currentState = get();
          // Only update if different to avoid unnecessary re-renders
          if (currentState.mode !== cachedMode || currentState.isLoading) {
            set({ mode: cachedMode, isLoading: false });
          }
          return;
        }
      }

      try {
        set({ isLoading: true, error: null });

        const response = await fetch('/api/backend/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const detectedMode = data.available ? 'backend' : 'local';
          set({ mode: detectedMode, isLoading: false });
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('torboxBackendMode', detectedMode);
          }
        } else {
          set({ mode: 'local', isLoading: false });
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
        set({ mode: 'local', error: err.message, isLoading: false });
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('torboxBackendMode', 'local');
        }
      }
    },
  };
});

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
