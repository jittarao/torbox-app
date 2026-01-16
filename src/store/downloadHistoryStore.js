import { create } from 'zustand';

/**
 * Download history store
 * Manages link history state and fetching from backend
 */
export const useDownloadHistoryStore = create((set, get) => ({
  downloadHistory: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  // Fetch download history from backend
  fetchDownloadHistory: async (apiKey) => {
    // Check if API key exists and is not empty
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      set({ downloadHistory: [], error: null });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // Fetch all link history (no pagination for highlighting)
      const response = await fetch('/api/link-history?limit=1000', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
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
      } else {
        // Backend error - log error details and set empty array
        const errorData = await response.json().catch(() => ({}));
        console.error('Error fetching link history from backend:', {
          status: response.status,
          error: errorData.error || 'Unknown error',
          detail: errorData.detail,
        });
        set({
          downloadHistory: [],
          isLoading: false,
          error: errorData.error || 'Failed to fetch link history',
        });
      }
    } catch (error) {
      // Network error - set empty array
      console.error('Error fetching link history from backend:', error);
      set({
        downloadHistory: [],
        isLoading: false,
        error: error.message || 'Network error',
      });
    }
  },

  // Clear download history (useful when API key changes)
  clearDownloadHistory: () => {
    set({ downloadHistory: [], error: null, lastFetched: null });
  },
}));
