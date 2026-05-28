import { create } from 'zustand';
import { isBackendAvailable } from '@/store/backendModeStore';
import { isValidTorboxApiKey } from '@/utils/apiKeyValidation';

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
        // Keyset pages for highlighting; backend allows up to 1000 per request
        const PAGE_SIZE = 1000;
        const MAX_ROWS = 8000;
        const merged = [];
        let cursor = null;

        while (merged.length < MAX_ROWS) {
          const qs = new URLSearchParams({
            keyset: '1',
            limit: String(PAGE_SIZE),
          });
          if (cursor) {
            qs.set('cursor', cursor);
          }

          const response = await fetch(`/api/link-history?${qs.toString()}`, {
            headers: {
              'x-api-key': apiKey,
            },
          });

          if (!response.ok) {
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
          }

          const data = await response.json();
          const state = get();
          if (state.activeRequestId !== requestId || state.currentApiKey !== apiKey) {
            return [];
          }

          const batch = data.data || [];
          for (const item of batch) {
            merged.push({
              id: item.file_id ? `${item.item_id}-${item.file_id}` : item.item_id,
              itemId: item.item_id,
              fileId: item.file_id || null,
              url: item.url,
              assetType: item.asset_type,
              generatedAt: item.generated_at,
              itemName: item.item_name || null,
              fileName: item.file_name || null,
            });
          }

          cursor = data.pagination?.nextCursor;
          if (!cursor || batch.length < PAGE_SIZE) {
            break;
          }
        }

        if (get().activeRequestId !== requestId || get().currentApiKey !== apiKey) {
          return [];
        }

        set({
          downloadHistory: merged,
          isLoading: false,
          error: null,
          lastFetched: new Date(),
        });
        return merged;
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
