'use client';
import { useState, useEffect, useCallback } from 'react';

export function useWebdlData(apiKey) {
  const [webdlItems, setWebdlItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWebdlItems = useCallback(
    async (bypassCache = false) => {
      if (!apiKey) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(`/api/webdl`, {
          headers: {
            'x-api-key': apiKey,
            ...(bypassCache && { 'bypass-cache': 'true' }),
          },
        });

        if (!response.ok) {
          throw new Error(
            `Error fetching web download data: ${response.status}`,
          );
        }

        const data = await response.json();

        if (
          data.success &&
          data.data &&
          Array.isArray(data.data) &&
          data.data.length > 0
        ) {
          setWebdlItems(data.data);
          setError(null);
        } else {
          console.error('Invalid web download data format:', data);
        }
      } catch (err) {
        console.error('Error fetching web download data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  useEffect(() => {
    fetchWebdlItems();

    // Set up polling every 30 seconds
    const intervalId = setInterval(fetchWebdlItems, 30000);

    return () => clearInterval(intervalId);
  }, [fetchWebdlItems]);

  return { webdlItems, loading, error, setWebdlItems, fetchWebdlItems };
}
