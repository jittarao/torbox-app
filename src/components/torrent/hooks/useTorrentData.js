import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { STATUS_OPTIONS } from '../constants';

// Rate limit constants
const MAX_CALLS = 5;
const WINDOW_SIZE = 10000; // 10 seconds in ms

// Helper functions moved outside hook
const isQueuedTorrent = (torrent) => 
  torrent.type === 'torrent' && 
  !torrent.download_state && 
  !torrent.download_finished && 
  !torrent.active;

const getAutoStartOptions = () => {
  const savedOptions = localStorage.getItem('torrent-upload-options');
  return savedOptions ? JSON.parse(savedOptions) : null;
};

const sortTorrents = (torrents) => 
  torrents.sort((a, b) => new Date(b.added || 0) - new Date(a.added || 0));

export function useTorrentData(apiKey) {
  const [torrents, setTorrents] = useState([]);
  const [loading, setLoading] = useState(false);
  const latestFetchIdRef = useRef(0);
  const callTimestampsRef = useRef([]);

  const isRateLimited = useCallback(() => {
    const now = Date.now();
    // Remove timestamps older than window size and keep only last MAX_CALLS
    callTimestampsRef.current = callTimestampsRef.current
      .filter(timestamp => now - timestamp < WINDOW_SIZE)
      .slice(-MAX_CALLS);
    return callTimestampsRef.current.length >= MAX_CALLS;
  }, []);

  const checkAndAutoStartTorrents = useCallback(async (torrents) => {
    try {
      const options = getAutoStartOptions();
      if (!options?.autoStart) return;

      const activeCount = torrents.filter(torrent => torrent.active).length;
      const queuedTorrents = torrents.filter(isQueuedTorrent);

      // If we have room for more active torrents and there are queued ones
      if (activeCount < options.autoStartLimit && queuedTorrents.length > 0) {
        // Force start the first queued torrent
        await fetch('/api/torrents/controlqueued', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            queued_id: queuedTorrents[0].id,
            operation: 'start',
            type: 'torrent'
          })
        });
      }
    } catch (error) {
      console.error('Error in auto-start check:', error);
    }
  }, [apiKey]);

  const fetchTorrents = useCallback(async (bypassCache = false) => {
    if (!apiKey || isRateLimited()) {
      if (isRateLimited()) console.warn('Rate limit reached, skipping fetch');
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
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      // if this call isn't the latest, do not update state
      if (currentFetchId !== latestFetchIdRef.current) return;
      
      if (data.success && data.data && Array.isArray(data.data)) {
        // Sort torrents by added date if available
        const sortedTorrents = sortTorrents(data.data);
        setTorrents(sortedTorrents);
        
        // Add auto-start check after setting torrents
        await checkAndAutoStartTorrents(sortedTorrents);
      } else {
        console.error('Invalid torrent data format:', data);
      }
    } catch (error) {
      console.error('Error fetching torrents:', error);
      // Only set error state if this is the latest fetch
      if (currentFetchId === latestFetchIdRef.current) {
        setTorrents([]);
      }
    } finally {
      // Only update loading state if this is the latest fetch call
      if (currentFetchId === latestFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [apiKey, isRateLimited, checkAndAutoStartTorrents]);

  // Polling for new torrents
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

    const shouldKeepPolling = () => {
      const options = getAutoStartOptions();
      if (!options?.autoStart) return false;
      return torrents.some(isQueuedTorrent);
    };

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
        if (inactiveDuration > 10000) fetchTorrents(true);
        lastInactiveTime = null;
        startPolling();
      } else if (!shouldKeepPolling()) {
        // Only stop polling if we don't need to keep checking for auto-start
        lastInactiveTime = Date.now();
        stopPolling();
      }
    };

    // Initial fetch and polling setup
    fetchTorrents(true);
    if (isVisible || shouldKeepPolling()) startPolling();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      stopPolling();
      clearInterval(cleanupInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchTorrents]); // Reduced dependencies

  // Memoize return object
  return useMemo(() => ({ 
    torrents, 
    loading,
    fetchTorrents,
    setTorrents
  }), [torrents, loading, fetchTorrents]);
}