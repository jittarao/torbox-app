import { create } from 'zustand';

export const useRssStore = create((set, get) => ({
  feeds: [],
  loading: false,
  error: null,
  currentApiKey: null,
  activeRequestId: 0,

  setApiKey: (apiKey) => {
    const { currentApiKey } = get();
    if (currentApiKey !== apiKey) {
      set({
        currentApiKey: apiKey,
        feeds: [],
        error: null,
        activeRequestId: get().activeRequestId + 1,
      });
    }
  },

  isRequestCurrent: (apiKey, requestId) =>
    get().activeRequestId === requestId && get().currentApiKey === apiKey,

  fetchFeeds: async (apiKey) => {
    if (!apiKey) return;

    const { currentApiKey, loading } = get();
    if (loading) return;

    if (currentApiKey !== apiKey) {
      get().setApiKey(apiKey);
    }

    const requestId = get().activeRequestId + 1;
    set({ loading: true, error: null, activeRequestId: requestId });

    try {
      const response = await fetch('/api/rss', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch RSS feeds');
      }

      const data = await response.json();

      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }

      if (data.success) {
        set({ feeds: data.data || [], loading: false });
      } else {
        throw new Error(data.error || 'Failed to fetch RSS feeds');
      }
    } catch (err) {
      if (!get().isRequestCurrent(apiKey, requestId)) {
        return;
      }
      console.error('Error fetching RSS feeds:', err);
      set({ error: err.message, loading: false });
    }
  },

  addFeed: async (apiKey, feedData) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          action: 'add',
          ...feedData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await get().fetchFeeds(apiKey);
        return { success: true, data: data.data };
      }

      let errorMessage = 'Failed to add RSS feed';
      if (data.error) {
        errorMessage = Array.isArray(data.error) ? data.error.join(', ') : data.error;
      }
      return { success: false, error: errorMessage };
    } catch (err) {
      console.error('Error adding RSS feed:', err);
      return { success: false, error: err.message };
    }
  },

  modifyFeed: async (apiKey, feedData) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          action: 'modify',
          ...feedData,
        }),
      });

      const data = await response.json();

      if (data.success) {
        await get().fetchFeeds(apiKey);
        return { success: true, data: data.data };
      }

      let errorMessage = 'Failed to modify RSS feed';
      if (data.error) {
        errorMessage = Array.isArray(data.error) ? data.error.join(', ') : data.error;
      }
      return { success: false, error: errorMessage };
    } catch (err) {
      console.error('Error modifying RSS feed:', err);
      return { success: false, error: err.message };
    }
  },

  controlFeed: async (apiKey, feedId, operation) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch('/api/rss/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          rss_feed_id: feedId,
          operation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        try {
          await get().fetchFeeds(apiKey);
        } catch (error) {
          console.error('Failed to refresh feeds:', error);
        }
        return { success: true, data: data.data };
      }

      let errorMessage = 'Failed to control RSS feed';
      if (data.error) {
        errorMessage = Array.isArray(data.error) ? data.error.join(', ') : data.error;
      }
      return { success: false, error: errorMessage };
    } catch (err) {
      console.error('Error controlling RSS feed:', err);
      return { success: false, error: err.message };
    }
  },

  getFeedItems: async (apiKey, feedId, offset = 0, limit = 100) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch(
        `/api/rss/items?feed_id=${feedId}&offset=${offset}&limit=${limit}`,
        {
          headers: {
            'x-api-key': apiKey,
          },
        }
      );

      const data = await response.json();

      if (data.success) {
        return { success: true, data: data.data || [] };
      }

      return { success: false, error: data.error || 'Failed to fetch RSS feed items' };
    } catch (err) {
      console.error('Error fetching RSS feed items:', err);
      return { success: false, error: err.message };
    }
  },
}));
