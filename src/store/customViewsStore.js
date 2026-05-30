import { create } from 'zustand';
import { isBackendAvailable } from '@/store/backendModeStore';
import { createApiKeyScopedSlice } from '@/store/createApiKeyScopedStore';

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const useCustomViewsStore = create((set, get) => ({
  views: [],
  activeView: null,
  loading: false,
  error: null,
  hasLoaded: false,
  ...createApiKeyScopedSlice(set, get, {
    views: [],
    activeView: null,
    error: null,
    hasLoaded: false,
  }),

  // Load views from API
  loadViews: async (apiKey, { force = false } = {}) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      set({ views: [], loading: false, error: null });
      return;
    }

    const { currentApiKey, loading, hasLoaded } = get();

    // Prevent duplicate concurrent calls: if already loading, skip
    if (loading) {
      return;
    }

    if (!force && hasLoaded && currentApiKey === apiKey) {
      return;
    }

    // If API key changed, reset views first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/custom-views', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 503) {
          set({ views: [], loading: false, error: null, hasLoaded: true });
          return;
        }
        const message = await readApiError(response, 'Failed to load views');
        set({ error: message, loading: false, hasLoaded: true });
        return;
      }

      const data = await response.json();
      if (data.success) {
        set({ views: data.views || [], loading: false, hasLoaded: true });
      } else {
        set({ error: data.error || 'Failed to load views', loading: false, hasLoaded: true });
      }
    } catch (err) {
      console.error('Error loading views:', err);
      set({
        error: err?.message || 'Failed to load views',
        loading: false,
        hasLoaded: true,
      });
    }
  },

  // Save a new view
  saveView: async (apiKey, name, filters, sort, columns, assetType = null, searchQuery = null) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Custom views feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/custom-views', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          filters,
          sort_field: sort?.field || null,
          sort_direction: sort?.direction || null,
          visible_columns: columns || null,
          asset_type: assetType || null,
          search_query: searchQuery?.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save view');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading views
        set({ loading: false });
        // Reload views after creation
        await get().loadViews(apiKey, { force: true });
        return data.view;
      } else {
        throw new Error(data.error || 'Failed to save view');
      }
    } catch (err) {
      console.error('Error saving view:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Update an existing view
  updateView: async (apiKey, id, updates) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Custom views feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/custom-views/${id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update view');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading views
        set({ loading: false });
        // Reload views after update
        await get().loadViews(apiKey, { force: true });
        // Update active view if it's the one being updated
        const { activeView } = get();
        if (activeView?.id === id) {
          set({ activeView: data.view });
        }
        return data.view;
      } else {
        throw new Error(data.error || 'Failed to update view');
      }
    } catch (err) {
      console.error('Error updating view:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Delete a view
  deleteView: async (apiKey, id) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Custom views feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/custom-views/${id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete view');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading views
        set({ loading: false });
        // Reload views after deletion
        await get().loadViews(apiKey, { force: true });
        // Clear active view if it's the one being deleted
        const { activeView } = get();
        if (activeView?.id === id) {
          set({ activeView: null });
        }
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete view');
      }
    } catch (err) {
      console.error('Error deleting view:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Apply a view (set as active)
  applyView: (view) => {
    set({ activeView: view });
  },

  // Clear active view
  clearView: () => {
    set({ activeView: null });
  },
}));
