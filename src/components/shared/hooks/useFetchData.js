import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isQueuedItem, getAutoStartOptions, sortItems } from '@/utils/utility';

// Rate limit constants
const MAX_CALLS = 5;
const WINDOW_SIZE = 10000; // 10 seconds in ms
const MIN_INTERVAL_BETWEEN_CALLS = 2000; // Minimum 2 seconds between calls
const MIN_INTERVAL_MAPPING = { torrents: 2000, usenet: 2000, webdl: 2000 };
const ACTIVE_POLLING_INTERVAL = 10000; // 10 seconds in ms
const INACTIVE_POLLING_INTERVAL = 60000; // 1 minute in ms

export function useFetchData(apiKey, type = 'torrents') {
  // Separate state for each data type
  const [torrents, setTorrents] = useState([]);
  const [usenetItems, setUsenetItems] = useState([]);
  const [webdlItems, setWebdlItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const torrentsRef = useRef([]);
  const usenetRef = useRef([]);
  const webdlRef = useRef([]);

  // A per-type rate limit tracker
  const rateLimitDataRef = useRef({});

  // Update refs whenever state changes
  useEffect(() => {
    torrentsRef.current = torrents;
  }, [torrents]);

  useEffect(() => {
    usenetRef.current = usenetItems;
  }, [usenetItems]);

  useEffect(() => {
    webdlRef.current = webdlItems;
  }, [webdlItems]);

  // One-time effect to fetch all data types on initial mount
  useEffect(() => {
    const fetchAllTypes = async () => {
      if (!apiKey) return;

      await Promise.all([
        fetchLocalItems(true, 'torrents'),
        fetchLocalItems(true, 'usenet'),
        fetchLocalItems(true, 'webdl'),
      ]);
    };

    fetchAllTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isRateLimited = useCallback(
    (activeType = type) => {
      // Ensure rate limit data exists for the current type
      if (!rateLimitDataRef.current[activeType]) {
        rateLimitDataRef.current[activeType] = {
          callTimestamps: [],
          lastFetchTime: 0,
          latestFetchId: 0,
        };
      }
      const rateData = rateLimitDataRef.current[activeType];
      const now = Date.now();
      const minInterval =
        MIN_INTERVAL_MAPPING[activeType] || MIN_INTERVAL_BETWEEN_CALLS;
      if (now - rateData.lastFetchTime < minInterval) {
        return true;
      }
      // Filter outdated timestamps and take last MAX_CALLS
      rateData.callTimestamps = rateData.callTimestamps
        .filter((timestamp) => now - timestamp < WINDOW_SIZE)
        .slice(-MAX_CALLS);
      return rateData.callTimestamps.length >= MAX_CALLS;
    },
    [type],
  );

  const checkAndAutoStartTorrents = useCallback(
    async (items) => {
      // Only apply auto-start to torrents
      if (type !== 'torrents') return;

      try {
        const options = getAutoStartOptions();
        if (!options?.autoStart) return;

        const activeCount = items.filter((item) => item.active).length;
        const queuedItems = items.filter(isQueuedItem);

        // If we have room for more active items and there are queued ones
        if (activeCount < options.autoStartLimit && queuedItems.length > 0) {
          // Force start the first queued item
          await fetch('/api/torrents/controlqueued', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({
              queued_id: queuedItems[0].id,
              operation: 'start',
              type: 'torrent',
            }),
          });
        }
      } catch (error) {
        console.error('Error in auto-start check:', error);
      }
    },
    [apiKey, type],
  );

  const fetchLocalItems = useCallback(
    async (bypassCache = false, customType = null) => {
      const activeType = customType || type;
      setLoading(true);

      if (!apiKey) {
        setLoading(false);
        return [];
      }

      // Ensure rate limit data exists for the active type
      if (!rateLimitDataRef.current[activeType]) {
        rateLimitDataRef.current[activeType] = {
          callTimestamps: [],
          lastFetchTime: 0,
          latestFetchId: 0,
        };
      }
      const rateData = rateLimitDataRef.current[activeType];

      if (isRateLimited(activeType)) {
        console.warn(`Rate limit reached for ${activeType}, skipping fetch`);
        return [];
      }

      // Update rate limiting data
      const now = Date.now();
      rateData.lastFetchTime = now;
      rateData.callTimestamps.push(now);
      const currentFetchId = ++rateData.latestFetchId;

      // If this call isn't the latest, do not update state
      if (currentFetchId !== rateData.latestFetchId) {
        return [];
      }

      // Determine endpoint based on activeType
      let endpoint;
      switch (activeType) {
        case 'usenet':
          endpoint = '/api/usenet';
          break;
        case 'webdl':
          endpoint = '/api/webdl';
          break;
        default:
          endpoint = '/api/torrents';
      }

      try {
        const response = await fetch(endpoint, {
          headers: {
            'x-api-key': apiKey,
            ...(bypassCache && { 'bypass-cache': 'true' }),
          },
        });

        if (!response.ok) {
          throw new Error(
            `Error fetching ${activeType} data: ${response.status}`,
          );
        }

        const data = await response.json();

        if (
          data.success &&
          data.data &&
          Array.isArray(data.data) &&
          data.data.length > 0
        ) {
          // Sort items by added date if available
          const sortedItems = sortItems(data.data);

          // Update the appropriate state based on the type
          switch (activeType) {
            case 'usenet':
              setUsenetItems(sortedItems);
              break;
            case 'webdl':
              setWebdlItems(sortedItems);
              break;
            default:
              setTorrents(sortedItems);
              // Only check auto-start for torrents
              await checkAndAutoStartTorrents(sortedItems);
          }

          if (activeType === type) {
            setError(null);
          }

          setLoading(false);

          // Return the fetched data
          return sortedItems;
        } else {
          console.error(`Invalid ${activeType} data format:`, data);
          setLoading(false);
          return [];
        }
      } catch (err) {
        console.error(`Error fetching ${activeType} data:`, err);
        // Only set error state if this is the latest fetch and current type
        if (currentFetchId === rateData.latestFetchId && activeType === type) {
          setError(err.message);
        }
        setLoading(false);
        return [];
      }
    },
    [apiKey, checkAndAutoStartTorrents, isRateLimited, type],
  );

  // Fetch data on type change
  useEffect(() => {
    const initialFetch = async () => {
      // Only fetch the current active type when type changes
      await fetchLocalItems(true, type);
    };

    initialFetch();
  }, [type, fetchLocalItems]);

  // Active data based on the current type
  const items = useMemo(() => {
    switch (type) {
      case 'usenet':
        return usenetItems || [];
      case 'webdl':
        return webdlItems || [];
      default:
        return torrents || [];
    }
  }, [type, torrents, usenetItems, webdlItems]);

  // Setter and fetch functions based on the current type
  const setItems = useMemo(() => {
    switch (type) {
      case 'usenet':
        return setUsenetItems;
      case 'webdl':
        return setWebdlItems;
      default:
        return setTorrents;
    }
  }, [type, setUsenetItems, setWebdlItems, setTorrents]);

  // Fetch items based on the current type
  const fetchItems = useMemo(() => {
    return (bypassCache) => {
      switch (type) {
        case 'usenet':
          return fetchLocalItems(bypassCache, 'usenet');
        case 'webdl':
          return fetchLocalItems(bypassCache, 'webdl');
        default:
          return fetchLocalItems(bypassCache, 'torrents');
      }
    };
  }, [type, fetchLocalItems]);

  // Polling for new items
  useEffect(() => {
    let interval;
    let lastInactiveTime = null;
    let isVisible = document.visibilityState === 'visible';
    let currentPollingInterval = ACTIVE_POLLING_INTERVAL;

    // Setup cleanup interval for the active type
    let cleanupInterval;
    if (!rateLimitDataRef.current[type]) {
      rateLimitDataRef.current[type] = {
        callTimestamps: [],
        lastFetchTime: 0,
        latestFetchId: 0,
      };
    }

    cleanupInterval = setInterval(() => {
      const now = Date.now();
      const rateData = rateLimitDataRef.current[type];
      if (rateData) {
        rateData.callTimestamps = rateData.callTimestamps
          .filter((timestamp) => now - timestamp < WINDOW_SIZE)
          .slice(-MAX_CALLS);
      }
    }, WINDOW_SIZE);

    const shouldKeepFastPolling = () => {
      // Keep fast polling for torrents with auto-start enabled and queued items
      if (type === 'torrents') {
        const options = getAutoStartOptions();
        if (options?.autoStart && torrentsRef.current.some(isQueuedItem)) {
          return true;
        }
      }
      return false;
    };

    const startPolling = () => {
      stopPolling(); // Clear any existing interval first

      // Determine polling interval based on visibility and auto-start conditions
      currentPollingInterval =
        isVisible || shouldKeepFastPolling()
          ? ACTIVE_POLLING_INTERVAL
          : INACTIVE_POLLING_INTERVAL;

      interval = setInterval(() => {
        // Check rate limiting for current type
        if (!isRateLimited()) {
          fetchLocalItems(true);
        }
      }, currentPollingInterval);
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
        const inactiveDuration = lastInactiveTime
          ? Date.now() - lastInactiveTime
          : 0;
        // Only fetch if we've been inactive for a while and not rate limited
        if (inactiveDuration > 10000 && !isRateLimited()) {
          fetchLocalItems(true);
        }
        lastInactiveTime = null;
      } else {
        lastInactiveTime = Date.now();
      }

      // Always restart polling with appropriate interval
      startPolling();
    };

    // Initial polling start
    startPolling();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      if (cleanupInterval) clearInterval(cleanupInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchLocalItems, isRateLimited, type]);

  // Return all data types and their setters
  return {
    loading,
    error,
    items,
    setItems,
    fetchItems,
  };
}
