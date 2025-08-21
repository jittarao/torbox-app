import { useState, useEffect, useCallback } from 'react';
import { createApiClient } from '@/utils/apiClient';

export function useRssFeeds(apiKey) {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiClient = createApiClient(apiKey);

  // Fetch all RSS feeds
  const fetchFeeds = useCallback(async () => {
    if (!apiKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/rss', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch RSS feeds');
      }

      const data = await response.json();
      
      if (data.success) {
        setFeeds(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch RSS feeds');
      }
    } catch (err) {
      console.error('Error fetching RSS feeds:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  // Add a new RSS feed
  const addFeed = useCallback(async (feedData) => {
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
        // Refresh feeds after adding
        await fetchFeeds();
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error || 'Failed to add RSS feed' };
      }
    } catch (err) {
      console.error('Error adding RSS feed:', err);
      return { success: false, error: err.message };
    }
  }, [apiKey, fetchFeeds]);

  // Modify an existing RSS feed
  const modifyFeed = useCallback(async (feedData) => {
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
        // Refresh feeds after modifying
        await fetchFeeds();
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error || 'Failed to modify RSS feed' };
      }
    } catch (err) {
      console.error('Error modifying RSS feed:', err);
      return { success: false, error: err.message };
    }
  }, [apiKey, fetchFeeds]);

  // Control RSS feed (enable/disable/delete)
  const controlFeed = useCallback(async (feedId, operation) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch('/api/rss/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          feed_id: feedId,
          operation,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh feeds after control operation
        await fetchFeeds();
        return { success: true, data: data.data };
      } else {
        return { success: false, error: data.error || 'Failed to control RSS feed' };
      }
    } catch (err) {
      console.error('Error controlling RSS feed:', err);
      return { success: false, error: err.message };
    }
  }, [apiKey, fetchFeeds]);

  // Fetch RSS feed items
  const getFeedItems = useCallback(async (feedId, offset = 0, limit = 100) => {
    if (!apiKey) return { success: false, error: 'API key required' };

    try {
      const response = await fetch(
        `/api/rss/items?feed_id=${feedId}&offset=${offset}&limit=${limit}`,
        {
          headers: {
            'x-api-key': apiKey,
          },
        },
      );

      const data = await response.json();

      if (data.success) {
        return { success: true, data: data.data || [] };
      } else {
        return { success: false, error: data.error || 'Failed to fetch RSS feed items' };
      }
    } catch (err) {
      console.error('Error fetching RSS feed items:', err);
      return { success: false, error: err.message };
    }
  }, [apiKey]);

  // Initial fetch
  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  return {
    feeds,
    loading,
    error,
    fetchFeeds,
    addFeed,
    modifyFeed,
    controlFeed,
    getFeedItems,
  };
}
