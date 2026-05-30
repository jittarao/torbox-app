import { create } from 'zustand';
import { isBackendAvailable } from '@/utils/backendModeCache';
import { createApiKeyScopedSlice } from '@/store/createApiKeyScopedStore';

export const useTagsStore = create((set, get) => ({
  tags: [],
  loading: false,
  error: null,
  hasLoaded: false,
  ...createApiKeyScopedSlice(set, get, { tags: [], error: null, hasLoaded: false }),

  // Load tags from API
  loadTags: async (apiKey, { force = false } = {}) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      set({ tags: [], loading: false, error: null });
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

    // If API key changed, reset tags first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    const requestId = get().activeRequestId + 1;
    set({ loading: true, error: null, activeRequestId: requestId });
    try {
      const response = await fetch('/api/tags', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (data.success) {
        set({ tags: data.tags || [], loading: false, hasLoaded: true });
      } else {
        throw new Error(data.error || 'Failed to load tags');
      }
    } catch (err) {
      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }
      console.error('Error loading tags:', err);
      set({ error: err.message, loading: false, hasLoaded: true });
    }
  },

  // Create a new tag
  createTag: async (apiKey, name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Tags feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/tags', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create tag');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading tags
        set({ loading: false });
        // Reload tags after creation
        await get().loadTags(apiKey, { force: true });
        return data.tag;
      } else {
        throw new Error(data.error || 'Failed to create tag');
      }
    } catch (err) {
      console.error('Error creating tag:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Update an existing tag
  updateTag: async (apiKey, id, name) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Tags feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update tag');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading tags
        set({ loading: false });
        // Reload tags after update
        await get().loadTags(apiKey, { force: true });
        return data.tag;
      } else {
        throw new Error(data.error || 'Failed to update tag');
      }
    } catch (err) {
      console.error('Error updating tag:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Delete a tag
  deleteTag: async (apiKey, id) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      throw new Error('Tags feature is disabled when backend is disabled');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch(`/api/tags/${id}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete tag');
      }

      const data = await response.json();
      if (data.success) {
        // Reset loading before reloading tags
        set({ loading: false });
        // Reload tags after deletion
        await get().loadTags(apiKey, { force: true });
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete tag');
      }
    } catch (err) {
      console.error('Error deleting tag:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
