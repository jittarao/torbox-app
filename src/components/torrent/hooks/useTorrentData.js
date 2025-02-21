import { useState, useEffect } from 'react';

export function useTorrentData(apiKey) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTorrents = async (bypassCache = false) => {
    if (!apiKey) return;
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch('/api/torrents', {
        headers: { 
          'x-api-key': apiKey,
          ...(bypassCache && { 'bypass-cache': 'true' })
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setTorrents(data.data);
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    let interval;
    let lastInactiveTime = null;
    let isVisible = document.visibilityState === 'visible';

    const startPolling = () => {
      stopPolling(); // Clear any existing interval first
      interval = setInterval(() => fetchTorrents(true), 10000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      
      if (isVisible) {
        const inactiveDuration = lastInactiveTime ? Date.now() - lastInactiveTime : 0;
        if (inactiveDuration > 10000) {
          fetchTorrents(true);
        }
        lastInactiveTime = null;
        startPolling();
      } else {
        lastInactiveTime = Date.now();
        stopPolling();
      }
    };

    // Initial fetch and polling setup
    fetchTorrents(true);
    if (isVisible) {
      startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [apiKey]);

  return { 
    torrents, 
    loading,
    fetchTorrents,
    setTorrents
  };
}