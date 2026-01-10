import { create } from 'zustand';

export const useDownloadTagsStore = create((set, get) => ({
  tagMappings: {}, // { downloadId: [{ id, name }] }
  loading: false,
  error: null,
  currentApiKey: null,

  // Reset mappings when API key changes
  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        tagMappings: {},
        error: null,
      });
    }
  },

  // Fetch all download-tag mappings from /api/downloads/tags
  fetchDownloadTags: async (apiKey) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    const { currentApiKey, loading } = get();

    // Prevent duplicate concurrent calls: if already loading, skip
    if (loading) {
      return;
    }

    // If API key changed, reset mappings first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    set({ loading: true, error: null });
    try {
      const url = new URL('/api/downloads/tags', window.location.origin);

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load download tags');
      }

      const data = await response.json();
      if (data.success) {
        set({ tagMappings: data.mappings || {}, loading: false });
        return data.mappings || {};
      } else {
        throw new Error(data.error || 'Failed to load download tags');
      }
    } catch (err) {
      console.error('Error loading download tags:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Assign tags to downloads (bulk operation)
  assignTags: async (apiKey, downloadIds, tagIds, operation = 'add') => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    set({ loading: true, error: null });
    try {
      const response = await fetch('/api/downloads/tags', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          download_ids: downloadIds,
          tag_ids: tagIds,
          operation,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to assign tags');
      }

      const data = await response.json();
      if (data.success) {
        // Fetch latest download-tags list from /api/downloads/tags after assignment
        await get().fetchDownloadTags(apiKey);
        return true;
      } else {
        throw new Error(data.error || 'Failed to assign tags');
      }
    } catch (err) {
      console.error('Error assigning tags:', err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },
}));
