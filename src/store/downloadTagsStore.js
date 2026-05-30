import { create } from 'zustand';
import { isBackendAvailable } from '@/utils/backendModeCache';
import { createApiKeyScopedSlice } from '@/store/createApiKeyScopedStore';

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const useDownloadTagsStore = create((set, get) => ({
  tagMappings: {},
  loading: false,
  error: null,
  hasLoaded: false,
  ...createApiKeyScopedSlice(set, get, { tagMappings: {}, error: null, hasLoaded: false }),

  // Fetch all download-tag mappings from /api/downloads/tags
  fetchDownloadTags: async (apiKey, { force = false } = {}) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    if (!isBackendAvailable()) {
      set({ tagMappings: {}, loading: false, error: null });
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

    // If API key changed, reset mappings first
    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    const requestId = get().activeRequestId + 1;
    set({ loading: true, error: null, activeRequestId: requestId });
    try {
      const url = new URL('/api/downloads/tags', window.location.origin);

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (!response.ok) {
        if (response.status === 503) {
          set({ tagMappings: {}, loading: false, error: null, hasLoaded: true });
          return {};
        }
        const message = await readApiError(response, 'Failed to load download tags');
        set({ error: message, loading: false, hasLoaded: true });
        return;
      }

      const data = await response.json();
      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (data.success) {
        set({ tagMappings: data.mappings || {}, loading: false, hasLoaded: true });
        return data.mappings || {};
      }

      set({
        error: data.error || 'Failed to load download tags',
        loading: false,
        hasLoaded: true,
      });
    } catch (err) {
      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }
      console.error('Error loading download tags:', err);
      set({
        error: err?.message || 'Failed to load download tags',
        loading: false,
        hasLoaded: true,
      });
    }
  },

  // Assign tags to downloads (bulk operation)
  assignTags: async (apiKey, downloadIds, tagIds, operation = 'add') => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!isBackendAvailable()) {
      throw new Error('Download tags feature is disabled when backend is disabled');
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
        // Reset loading before fetching download tags
        set({ loading: false });
        // Fetch latest download-tags list from /api/downloads/tags after assignment
        await get().fetchDownloadTags(apiKey, { force: true });
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
