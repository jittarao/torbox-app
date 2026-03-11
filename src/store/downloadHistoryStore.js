import { create } from 'zustand';
import { useBackendModeStore } from '@/store/backendModeStore';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';

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
 * Download history store
 * Manages link history state and fetching from backend
 */
export const useDownloadHistoryStore = create((set, get) => ({
  downloadHistory: [],
  isLoading: false,
  error: null,
  lastFetched: null,
  currentApiKey: null,
  activeRequestId: 0,
  fetchPromise: null,

  // Fetch download history from backend
  fetchDownloadHistory: async (apiKey) => {
    // Check if API key exists and is not empty
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      set({ downloadHistory: [], error: null });
      return;
    }
    // Never send invalid key to API (e.g. draft/partial input)
    if (!isValidTorboxApiKey(apiKey)) {
      set({ isLoading: false, error: null });
      return;
    }

    // Check if backend is available
    if (!isBackendAvailable()) {
      set({ downloadHistory: [], isLoading: false, error: null });
      return;
    }

    const { fetchPromise, currentApiKey } = get();
    if (fetchPromise && currentApiKey === apiKey) {
      return fetchPromise;
    }

    const requestId = get().activeRequestId + 1;
    const fetchPromiseForRequest = (async () => {
      set({
        isLoading: true,
        error: null,
        currentApiKey: apiKey,
        activeRequestId: requestId,
      });

      try {
        // Fetch all link history (no pagination for highlighting)
        const response = await fetch('/api/link-history?limit=1000', {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const state = get();
          if (state.activeRequestId !== requestId || state.currentApiKey !== apiKey) {
            return [];
          }
          // Transform backend format to frontend format
          const transformedHistory = (data.data || []).map((item) => ({
            id: item.file_id ? `${item.item_id}-${item.file_id}` : item.item_id,
            itemId: item.item_id,
            fileId: item.file_id || null,
            url: item.url,
            assetType: item.asset_type,
            generatedAt: item.generated_at,
            itemName: item.item_name || null,
            fileName: item.file_name || null,
          }));

          set({
            downloadHistory: transformedHistory,
            isLoading: false,
            error: null,
            lastFetched: new Date(),
          });
          return transformedHistory;
        }

        const errorData = await response.json().catch(() => ({}));
        console.error('Error fetching link history from backend:', {
          status: response.status,
          error: errorData.error || 'Unknown error',
          detail: errorData.detail,
        });
        if (get().activeRequestId === requestId && get().currentApiKey === apiKey) {
          set({
            downloadHistory: [],
            isLoading: false,
            error: errorData.error || 'Failed to fetch link history',
          });
        }
        return [];
      } catch (error) {
        console.error('Error fetching link history from backend:', error);
        if (get().activeRequestId === requestId && get().currentApiKey === apiKey) {
          set({
            downloadHistory: [],
            isLoading: false,
            error: error.message || 'Network error',
          });
        }
        return [];
      } finally {
        if (get().activeRequestId === requestId) {
          set({ fetchPromise: null });
        }
      }
    })();

    set({ fetchPromise: fetchPromiseForRequest });
    return fetchPromiseForRequest;
  },

  // Clear download history (useful when API key changes)
  clearDownloadHistory: () => {
    set({
      downloadHistory: [],
      error: null,
      lastFetched: null,
      currentApiKey: null,
      fetchPromise: null,
    });
  },
}));
