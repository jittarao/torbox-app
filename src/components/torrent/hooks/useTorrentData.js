import { useState, useEffect } from 'react';

export function useTorrentData(apiKey) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTorrents = async (bypassCache = false) => {
    if (!apiKey) return;
    setLoading(true);
    try {
      const response = await fetch('/api/torrents', {
        headers: { 
          'x-api-key': apiKey,
          ...(bypassCache && { 'bypass-cache': 'true' })
        }
      });
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setTorrents(data.data);
      } else {
        setTorrents([]);
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
      setTorrents([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTorrents(true);
    const interval = setInterval(() => {
      fetchTorrents(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [apiKey]);

  return { 
    torrents, 
    loading, 
    fetchTorrents,
    setTorrents
  };
}