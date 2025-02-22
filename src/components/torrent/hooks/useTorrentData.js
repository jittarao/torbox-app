import { useState, useEffect, useRef } from 'react';

// Rate limit constants
const MAX_CALLS = 5;
const WINDOW_SIZE = 10000; // 10 seconds in ms

export function useTorrentData(apiKey) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);
  const latestFetchIdRef = useRef(0);
  const callTimestampsRef = useRef([]);

  const isRateLimited = () => {
    const now = Date.now();
    // Remove timestamps older than window size and keep only last MAX_CALLS
    callTimestampsRef.current = callTimestampsRef.current
      .filter(timestamp => now - timestamp < WINDOW_SIZE)
      .slice(-MAX_CALLS);
    return callTimestampsRef.current.length >= MAX_CALLS;
  };

  const fetchTorrents = async (bypassCache = false) => {
    if (!apiKey) return;
    
    if (isRateLimited()) {
      console.warn('Rate limit reached, skipping fetch');
      return;
    }
    
    callTimestampsRef.current.push(Date.now());
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    // increment the fetch id for each new call
    const currentFetchId = ++latestFetchIdRef.current;

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
      // if this call isn't the latest, do not update state
      if (currentFetchId !== latestFetchIdRef.current) return;
      
      if (data.success && data.data && Array.isArray(data.data)) {
        setTorrents(data.data);
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
    } finally {
      // Only update loading state if this is the latest fetch call
      if (currentFetchId === latestFetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let interval;
    let lastInactiveTime = null;
    let isVisible = document.visibilityState === 'visible';
    
    // Add cleanup interval
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      callTimestampsRef.current = callTimestampsRef.current
        .filter(timestamp => now - timestamp < WINDOW_SIZE)
        .slice(-MAX_CALLS);
    }, WINDOW_SIZE);

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
      clearInterval(cleanupInterval);
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