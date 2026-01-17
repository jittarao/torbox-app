import { create } from 'zustand';
import { useBackendModeStore } from '@/store/backendModeStore';

/**
 * Check if backend is available (not disabled)
 * Uses Zustand store for centralized state management
 */
function isBackendAvailable() {
  if (typeof window === 'undefined') return false;
  const { mode } = useBackendModeStore.getState();
  return mode === 'backend';
}

/**
 * Automation rules store
 * Manages automation rules state and fetching from backend
 */
export const useAutomationRulesStore = create((set, get) => ({
  rules: [],
  loading: false,
  error: null,
  currentApiKey: null,

  // Reset rules when API key changes
  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        rules: [],
        error: null,
      });
    }
  },

  // Load rules from API
  loadRules: async (apiKey) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      set({ rules: [], loading: false, error: null });
      return;
    }

    const { currentApiKey, loading } = get();

    // Prevent duplicate concurrent calls: if already loading, skip
    if (loading) {
      return;
    }

    // If API key changed, reset rules first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    set({ loading: true, error: null });

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch('/api/automation/rules', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        set({ rules: data.rules || [], loading: false });
      } else {
        // Backend unavailable, return empty array
        set({ rules: [], loading: false });
      }
    } catch (err) {
      console.error('Error loading automation rules:', err);
      set({ error: err.message, rules: [], loading: false });
    }
  },

  // Save rules to backend
  saveRules: async (apiKey, newRules) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      // No backend mode, just update local state
      set({ rules: newRules });
      return;
    }

    set({ loading: true, error: null });

    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers,
        body: JSON.stringify({ rules: newRules }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Backend save failed: ${response.status}`);
      }

      // Get the saved rules with database-assigned IDs from the response
      const data = await response.json();
      const savedRules = data.rules || [];

      // Update local state with the rules returned from backend (they have correct database IDs)
      set({ rules: savedRules, loading: false });
    } catch (err) {
      console.error('Error saving automation rules:', err);
      set({ error: err.message, loading: false });
      throw err; // Re-throw so caller can handle the error
    }
  },
}));
