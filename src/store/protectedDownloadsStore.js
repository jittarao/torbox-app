import { create } from 'zustand';
import { isBackendAvailable } from '@/utils/backendModeCache';
import { createApiKeyScopedSlice } from '@/store/createApiKeyScopedStore';
import { protectedIdsToMap } from '@/utils/downloadProtectionUtils';

/**
 * @param {Record<string, true>} protectedMap
 * @param {(string|number)[]} downloadIds
 * @param {boolean} isProtected
 */
export function applyOptimisticProtectedMap(protectedMap, downloadIds, isProtected) {
  const next = { ...protectedMap };

  for (const rawDownloadId of downloadIds) {
    const downloadId = String(rawDownloadId);
    if (isProtected) {
      next[downloadId] = true;
    } else {
      delete next[downloadId];
    }
  }

  return next;
}

async function readApiError(response, fallback) {
  try {
    const data = await response.json();
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const useProtectedDownloadsStore = create((set, get) => ({
  protectedMap: {},
  loading: false,
  error: null,
  hasLoaded: false,
  ...createApiKeyScopedSlice(set, get, {
    protectedMap: {},
    error: null,
    hasLoaded: false,
    loading: false,
  }),

  fetchProtectedDownloads: async (apiKey, { force = false } = {}) => {
    if (!apiKey) {
      set({ error: 'API key is required', loading: false });
      return;
    }

    if (!isBackendAvailable()) {
      set({ protectedMap: {}, loading: false, error: null });
      return;
    }

    const { currentApiKey, loading, hasLoaded } = get();

    if (loading) {
      return;
    }

    if (!force && hasLoaded && currentApiKey === apiKey) {
      return;
    }

    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    const requestId = get().activeRequestId + 1;
    set({ loading: true, error: null, activeRequestId: requestId });

    try {
      const response = await fetch('/api/downloads/protect', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!get().isRequestCurrent(apiKey, requestId)) {
        set({ loading: false });
        return;
      }

      if (!response.ok) {
        if (response.status === 503) {
          set({ protectedMap: {}, loading: false, error: null, hasLoaded: true });
          return {};
        }
        const message = await readApiError(response, 'Failed to load protected downloads');
        set({ error: message, loading: false, hasLoaded: true });
        return;
      }

      const data = await response.json();
      if (!get().isRequestCurrent(apiKey, requestId)) {
        set({ loading: false });
        return;
      }

      if (data.success) {
        const protectedMap = protectedIdsToMap(data.protected_ids);
        set({ protectedMap, loading: false, hasLoaded: true });
        return protectedMap;
      }

      set({
        error: data.error || 'Failed to load protected downloads',
        loading: false,
        hasLoaded: true,
      });
    } catch (err) {
      if (!get().isRequestCurrent(apiKey, requestId)) {
        set({ loading: false });
        return;
      }
      console.error('Error loading protected downloads:', err);
      set({
        error: err?.message || 'Failed to load protected downloads',
        loading: false,
        hasLoaded: true,
      });
    }
  },

  setProtected: async (apiKey, downloadIds, isProtected) => {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!isBackendAvailable()) {
      throw new Error('Protected downloads feature is disabled when backend is disabled');
    }

    const previousMap = get().protectedMap;
    const optimistic = applyOptimisticProtectedMap(previousMap, downloadIds, isProtected);
    set({ protectedMap: optimistic, error: null });

    try {
      const response = await fetch('/api/downloads/protect', {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          download_ids: downloadIds,
          protected: isProtected,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update download protection');
      }

      const data = await response.json();
      if (data.success) {
        set({ protectedMap: protectedIdsToMap(data.protected_ids) });
        return true;
      }

      set({ protectedMap: previousMap });
      throw new Error(data.error || 'Failed to update download protection');
    } catch (err) {
      console.error('Error updating download protection:', err);
      set({ protectedMap: previousMap, error: err.message });
      throw err;
    }
  },
}));
