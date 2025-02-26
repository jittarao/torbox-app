'use client';
import { useState, useEffect, useCallback } from 'react';

export function useUsenetData(apiKey) {
  const [usenetItems, setUsenetItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsenetItems = useCallback(
    async (bypassCache = false) => {
      if (!apiKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/usenet`, {
          headers: {
            'x-api-key': apiKey,
            ...(bypassCache && { 'bypass-cache': 'true' }),
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching usenet data: ${response.status}`);
        }

        const data = await response.json();
        setUsenetItems(data.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching usenet data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  useEffect(() => {
    fetchUsenetItems();

    // Set up polling every 30 seconds
    const intervalId = setInterval(fetchUsenetItems, 30000);

    return () => clearInterval(intervalId);
  }, [fetchUsenetItems]);

  return { usenetItems, loading, error, setUsenetItems, fetchUsenetItems };
}
