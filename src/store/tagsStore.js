import { create } from 'zustand';

export const useTagsStore = create((set, get) => ({
  tags: [],
  loading: false,
  error: null,
  currentApiKey: null,

  // Reset tags when API key changes
  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        tags: [],
        error: null,
      });
    }
  },

  // Load tags from API
  loadTags: async (apiKey) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    const { currentApiKey, loading } = get();

    // Prevent duplicate concurrent calls: if already loading, skip
    if (loading) {
      return;
    }

    // If API key changed, reset tags first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/tags', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load tags');
      }

      const data = await response.json();
      if (data.success) {
        set({ tags: data.tags || [], loading: false });
      } else {
        throw new Error(data.error || 'Failed to load tags');
      }
    } catch (err) {
      console.error('Error loading tags:', err);
      set({ error: err.message, loading: false });
    }
  },

  // Create a new tag
  createTag: async (apiKey, name) => {
    if (!apiKey) {
      throw new Error('API key is required');
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
        // Reload tags after creation
        await get().loadTags(apiKey);
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
        // Reload tags after update
        await get().loadTags(apiKey);
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
        // Reload tags after deletion
        await get().loadTags(apiKey);
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
