import { create } from 'zustand';
import { isBackendAvailable } from '@/utils/backendModeCache';
import { createApiKeyScopedSlice } from '@/store/createApiKeyScopedStore';

/**
 * Automation rules store
 * Manages automation rules state and fetching from backend
 */
export const useAutomationRulesStore = create((set, get) => ({
  rules: [],
  loading: false,
  error: null,
  ...createApiKeyScopedSlice(set, get, { rules: [], error: null }),

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

  // Fetch a portable export of the current rules (backend only)
  exportRules: async (apiKey) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    const response = await fetch('/api/automation/rules/export', {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Export failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Export failed');
    }
    return data.data;
  },

  // Append rules from an export file (backend only); existing rules are never replaced
  importRules: async (apiKey, payload) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    const response = await fetch('/api/automation/rules/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ data: payload }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Import failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Import failed');
    }

    const importedRules = data.importedRules || [];
    if (importedRules.length > 0 && get().currentApiKey === apiKey) {
      // Backend lists rules newest first; imported rows are the newest
      set({ rules: [...importedRules, ...get().rules] });
    }
    return {
      importedCount: importedRules.length,
      skipped: data.skipped || [],
      createdTagCount: data.createdTagCount || 0,
    };
  },
}));
