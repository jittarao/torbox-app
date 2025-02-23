import { useState, useEffect, useRef } from 'react';
import { STATUS_OPTIONS } from '../constants';

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

  const checkAndAutoStartTorrents = async (torrents) => {
    try {
      // Get global options from localStorage
      const savedOptions = localStorage.getItem('torrent-upload-options');
      const options = savedOptions ? JSON.parse(savedOptions) : null;
   
      if (!options?.autoStart) return;

      // Get active torrents count using proper status checking
      const activeCount = torrents.filter(torrent => torrent.active).length;

      // Check if essential fields are missing, indicating a queued torrent
      const queuedTorrents = torrents.filter(torrent => 
        torrent.type === 'torrent' && 
        !torrent.download_state && 
        !torrent.download_finished && 
        !torrent.active
      );

      // If we have room for more active torrents and there are queued ones
      if (activeCount < options.autoStartLimit && queuedTorrents.length > 0) {
        // Force start the first queued torrent
        const torrentToStart = queuedTorrents[0];
        await fetch('/api/torrents/controlqueued', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          },
          body: JSON.stringify({
            queued_id: torrentToStart.id,
            operation: 'force_start',
            type: 'torrent'
          })
        });
      }
    } catch (error) {
      console.error('Error in auto-start check:', error);
    }
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
        // Sort torrents by added date if available
        const sortedTorrents = data.data.sort((a, b) => {
          return new Date(b.added || 0) - new Date(a.added || 0);
        });
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
        setTorrents([]); // Clear torrents on error
      }
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