import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isQueuedItem, getAutoStartOptions, sortItems } from '@/utils/utility';
import { retryFetch } from '@/utils/retryFetch';
import { validateUserData } from '@/utils/monitoring';
import { perfMonitor } from '@/utils/performance';
import { usePollingPauseStore } from '@/store/pollingPauseStore';

// Rate limit constants
const MAX_CALLS = 5; // Maximum number of calls per WINDOW_SIZE
const WINDOW_SIZE = 10000; // 10 seconds in ms
const MIN_INTERVAL_BETWEEN_CALLS = 2000; // Minimum 2 seconds between calls
const MIN_INTERVAL_MAPPING = { torrents: 2000, usenet: 2000, webdl: 2000 };
const ACTIVE_POLLING_INTERVAL = 15000; // 15 seconds in ms
const INACTIVE_POLLING_INTERVAL = 60000; // 1 minute in ms
const AUTO_START_CHECK_INTERVAL = 30000; // 30 seconds in ms

// Polling Logic
// 1. ✅ 10s polling when browser is focused
// 2. ✅ 1m polling when browser is not focused AND auto-start is enabled AND there are queued torrents
// 3. ✅ No polling when browser is not focused AND (auto-start is disabled OR no queued torrents)

export function useFetchData(apiKey, type = 'torrents') {
  // Subscribe to pause reasons to trigger re-render when pause state changes
  const pauseReasons = usePollingPauseStore((state) => state.pauseReasons);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);
  // Separate state for each data type - ensure they're always arrays
  const [torrents, setTorrents] = useState([]);
  const [usenetItems, setUsenetItems] = useState([]);
  const [webdlItems, setWebdlItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const torrentsRef = useRef([]);
  const usenetRef = useRef([]);
  const webdlRef = useRef([]);
  const lastAutoStartCheckRef = useRef(0);
  const processedQueueIdsRef = useRef(new Set());
  const fetchInProgressRef = useRef(false);

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
      const minInterval = MIN_INTERVAL_MAPPING[activeType] || MIN_INTERVAL_BETWEEN_CALLS;
      if (now - rateData.lastFetchTime < minInterval) {
        return true;
      }
      // Filter outdated timestamps and take last MAX_CALLS
      rateData.callTimestamps = rateData.callTimestamps
        .filter((timestamp) => now - timestamp < WINDOW_SIZE)
        .slice(-MAX_CALLS);
      return rateData.callTimestamps.length >= MAX_CALLS;
    },
    [type]
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
          const queuedId = queuedItems[0].id;

          // Skip if we've already tried to start this item
          if (processedQueueIdsRef.current.has(queuedId)) return;

          // Add to processed set before making API call
          processedQueueIdsRef.current.add(queuedId);

          // Force start the first queued item
          await retryFetch('/api/torrents/controlqueued', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({
              queued_id: queuedId,
              operation: 'start',
              type: 'torrent',
            }),
          });
        }
      } catch (error) {
        console.error('Error in auto-start check:', error);
      }
    },
    [apiKey, type]
  );

  // Helper function to generate user-friendly error messages
  const getErrorMessage = useCallback((statusCode, activeType) => {
    const status = typeof statusCode === 'number' ? statusCode : null;
    const message = typeof statusCode === 'string' ? statusCode : null;

    if (status === 502) {
      return `TorBox servers are temporarily unavailable. ${activeType} data may not be up to date.`;
    } else if (status === 503) {
      return `TorBox servers are temporarily overloaded. ${activeType} data may not be up to date.`;
    } else if (status === 504) {
      return `TorBox servers are taking too long to respond. ${activeType} data may not be up to date.`;
    } else if (status === 401) {
      return 'Authentication failed. Please check your API key.';
    } else if (status === 403) {
      return 'Access denied. Please check your API key and account status.';
    } else if (status === 429) {
      return 'Too many requests to TorBox servers. Please wait a moment.';
    } else if (
      message &&
      (message.includes('NetworkError') || message.includes('Failed to fetch'))
    ) {
      return `Unable to connect to TorBox servers. ${activeType} data may not be up to date.`;
    }
    return `Failed to fetch ${activeType} data`;
  }, []);

  // Helper function to handle errors consistently
  const handleFetchError = useCallback(
    (error, activeType, currentFetchId, rateData, skipLoading, responseStatus = null) => {
      perfMonitor.endTimer(`fetch-${activeType}`);

      const statusCode =
        responseStatus ||
        (error?.message?.match(/\d{3}/)?.[0] ? parseInt(error.message.match(/\d{3}/)[0]) : null);
      const errorMessage =
        error?.error ||
        error?.message ||
        `Error fetching ${activeType} data${statusCode ? `: ${statusCode}` : ''}`;

      // Log as warning for server errors (5xx), not as error
      if (statusCode && statusCode >= 500) {
        console.warn(`Backend error fetching ${activeType} data (${statusCode}):`, errorMessage);
      } else {
        console.warn(
          `Error fetching ${activeType} data${statusCode ? ` (${statusCode})` : ''}:`,
          errorMessage
        );
      }

      // Only set error state if this is the latest fetch and current type
      if (currentFetchId === rateData.latestFetchId && activeType === type) {
        const userMessage = getErrorMessage(statusCode || error?.message, activeType);
        setError(userMessage);
      }

      if (!skipLoading) {
        setLoading(false);
      }
      return [];
    },
    [type, getErrorMessage, setError, setLoading]
  );

  const fetchLocalItems = useCallback(
    async (bypassCache = false, customType = null, retryCount = 0, skipLoading = false) => {
      const activeType = customType || type;

      // Prevent infinite retry loops
      if (retryCount > 1) {
        console.error('Max retry attempts reached, giving up');
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      // Check apiKey early, but don't set loading for 'all' type until all fetches complete
      if (!apiKey) {
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      // Only set loading to true for top-level calls (not when skipLoading is true)
      if (!skipLoading) {
        setLoading(true);
      }

      // Handle "all" type by fetching all three types
      // For 'all' type, we manage loading state only at the top level
      if (activeType === 'all') {
        // Fetch all three types with skipLoading=true so they don't modify loading state
        // Use Promise.allSettled to ensure we wait for ALL three fetches to complete,
        // regardless of success or failure, then set loading to false
        const results = await Promise.allSettled([
          fetchLocalItems(bypassCache, 'torrents', retryCount, true),
          fetchLocalItems(bypassCache, 'usenet', retryCount, true),
          fetchLocalItems(bypassCache, 'webdl', retryCount, true),
        ]);

        // Extract results from settled promises (handle both fulfilled and rejected)
        const flattenedResults = results
          .map((result) => (result.status === 'fulfilled' ? result.value : []))
          .flat();

        // Only set loading to false after ALL three fetches complete
        if (!skipLoading) {
          setLoading(false);
        }
        return flattenedResults;
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
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      // Update rate limiting data
      const now = Date.now();
      rateData.lastFetchTime = now;
      rateData.callTimestamps.push(now);
      const currentFetchId = ++rateData.latestFetchId;

      // If this call isn't the latest, do not update state
      if (currentFetchId !== rateData.latestFetchId) {
        if (!skipLoading) {
          setLoading(false);
        }
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
        perfMonitor.startTimer(`fetch-${activeType}`);
        const response = await fetch(endpoint, {
          headers: {
            'x-api-key': apiKey,
            ...(bypassCache && { 'bypass-cache': 'true' }),
            'Cache-Control': 'no-cache', // Force fresh data to prevent cross-user contamination
          },
        });

        // Handle non-OK responses gracefully
        if (!response.ok) {
          // Try to parse error response body for more details
          let errorData = {};
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            }
          } catch (parseError) {
            // If parsing fails, use empty object
          }

          return handleFetchError(
            errorData,
            activeType,
            currentFetchId,
            rateData,
            skipLoading,
            response.status
          );
        }

        // Parse response JSON
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          return handleFetchError(
            { message: `Failed to parse JSON: ${jsonError.message}` },
            activeType,
            currentFetchId,
            rateData,
            skipLoading
          );
        }

        perfMonitor.endTimer(`fetch-${activeType}`);

        // Handle valid response format
        if (data.success && data.data && Array.isArray(data.data)) {
          // Validate user data to prevent cross-user contamination
          if (!validateUserData(data.data, apiKey)) {
            console.warn(
              `Invalid user data detected (attempt ${retryCount + 1}/2), retrying with cache bypass`
            );
            // Add a small delay before retry to avoid overwhelming the API
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return fetchLocalItems(true, customType, retryCount + 1);
          }

          // Sort items by added date if available
          const sortedItems = sortItems(data.data);

          // Update the appropriate state based on the type
          switch (activeType) {
            case 'usenet':
              setUsenetItems(sortedItems.map((item) => ({ ...item, assetType: 'usenet' })));
              break;
            case 'webdl':
              setWebdlItems(sortedItems.map((item) => ({ ...item, assetType: 'webdl' })));
              break;
            default:
              setTorrents(sortedItems.map((item) => ({ ...item, assetType: 'torrents' })));
              // Only check auto-start for torrents if 30 seconds have elapsed
              if (now - lastAutoStartCheckRef.current >= AUTO_START_CHECK_INTERVAL) {
                await checkAndAutoStartTorrents(sortedItems);
                lastAutoStartCheckRef.current = now;
              }
          }

          if (activeType === type) {
            setError(null);
          }

          if (!skipLoading) {
            setLoading(false);
          }

          return sortedItems;
        }

        // Handle empty or invalid data formats gracefully
        if (data.success && data.data && Array.isArray(data.data) && data.data.length === 0) {
          // Empty data is valid, just return empty array
          if (!skipLoading) {
            setLoading(false);
          }
          return [];
        }

        // Invalid data format - log as warning and return empty array
        if (Object.keys(data).length === 0) {
          console.warn(`Backend returned empty response for ${activeType} data`);
        } else {
          console.warn(`Invalid ${activeType} data format:`, data);
        }

        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      } catch (err) {
        return handleFetchError(err, activeType, currentFetchId, rateData, skipLoading);
      }
    },
    [apiKey, checkAndAutoStartTorrents, isRateLimited, type, handleFetchError]
  );

  // Active data based on the current type
  const items = useMemo(() => {
    switch (type) {
      case 'all':
        // Combine all types (assetType is already present on each item)
        const allItems = [...(torrents || []), ...(usenetItems || []), ...(webdlItems || [])];
        return allItems;
      case 'usenet':
        return usenetItems || [];
      case 'webdl':
        return webdlItems || [];
      default:
        return torrents || [];
    }
  }, [type, torrents, usenetItems, webdlItems]);

  // Fetch data on type change or apiKey change
  useEffect(() => {
    // Return if apiKey is not set
    if (!apiKey) {
      // Set loading to false to prevent loading state from being stuck on true
      setLoading(false);
      fetchInProgressRef.current = false;
      return;
    }

    // Return if fetch is already in progress
    if (fetchInProgressRef.current) {
      return;
    }

    // Set fetchInProgressRef to true to prevent multiple simultaneous fetches
    fetchInProgressRef.current = true;

    const initialFetch = async () => {
      try {
        // Always show loading when effect runs (type/apiKey change). Don't use items.length
        // so we're not affected by stale closure or localStorage (e.g. incognito vs normal).
        await fetchLocalItems(true, type, 0, false);
      } finally {
        fetchInProgressRef.current = false;
        // Always clear loading when this effect's fetch finishes so the spinner never gets stuck
        // (e.g. if fetchLocalItems threw or 'all' path didn't call setLoading(false))
        setLoading(false);
      }
    };

    initialFetch();
  }, [type, apiKey]);

  // Setter and fetch functions based on the current type
  const setItems = useMemo(() => {
    switch (type) {
      case 'all':
        // For 'all' type, support both array and functional updates. Functional updates
        // run the updater on each list (torrents, usenet, webdl) so only the list
        // that contains the changed item actually updates (e.g. stop_seeding only touches setTorrents).
        return (newItemsOrUpdater) => {
          if (typeof newItemsOrUpdater === 'function') {
            const updater = newItemsOrUpdater;
            setTorrents((prev) => updater(prev || []));
            setUsenetItems((prev) => updater(prev || []));
            setWebdlItems((prev) => updater(prev || []));
          } else if (Array.isArray(newItemsOrUpdater)) {
            const list = newItemsOrUpdater;
            setTorrents(list.filter((item) => item.assetType === 'torrents'));
            setUsenetItems(list.filter((item) => item.assetType === 'usenet'));
            setWebdlItems(list.filter((item) => item.assetType === 'webdl'));
          } else {
            console.warn('setItems called with non-array and non-function:', newItemsOrUpdater);
          }
        };
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
        case 'all':
          // For 'all' type, fetch all types
          return Promise.all([
            fetchLocalItems(bypassCache, 'torrents', 0, true),
            fetchLocalItems(bypassCache, 'usenet', 0, true),
            fetchLocalItems(bypassCache, 'webdl', 0, true),
          ]);
        case 'usenet':
          return fetchLocalItems(bypassCache, 'usenet', 0, true);
        case 'webdl':
          return fetchLocalItems(bypassCache, 'webdl', 0, true);
        default:
          return fetchLocalItems(bypassCache, 'torrents', 0, true);
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
      // If polling is paused (e.g., video player is open), never poll
      if (isPollingPaused()) {
        return false;
      }
      // Keep fast polling for torrents with auto-start enabled and queued items
      if (type === 'torrents') {
        const options = getAutoStartOptions();
        if (options?.autoStart && torrentsRef.current.some(isQueuedItem)) {
          return true;
        }
      }
      return false;
    };

    // Check if we should treat the tab as inactive (either actually inactive or polling is paused)
    const isEffectivelyInactive = () => {
      // If polling is paused (e.g., video player is open), treat as inactive
      if (isPollingPaused()) {
        return true;
      }
      // Otherwise, use actual visibility state
      return !isVisible;
    };

    const startPolling = () => {
      stopPolling(); // Clear any existing interval first

      // If polling is paused, completely stop polling
      if (isPollingPaused()) {
        return;
      }

      // Determine polling interval based on visibility and auto-start conditions
      const effectivelyInactive = isEffectivelyInactive();
      if (!effectivelyInactive) {
        currentPollingInterval = ACTIVE_POLLING_INTERVAL;
      } else if (shouldKeepFastPolling()) {
        currentPollingInterval = INACTIVE_POLLING_INTERVAL;
      }

      // Only start polling if not effectively inactive or should keep fast polling
      if (!effectivelyInactive || shouldKeepFastPolling()) {
        interval = setInterval(() => {
          // Check rate limiting for current type
          if (!isRateLimited()) {
            fetchLocalItems(true, type, 0, true);
          }
        }, currentPollingInterval);
      }
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';

      // Only handle visibility changes if polling is not paused
      // When polling is paused (e.g., video player is open), we ignore visibility changes and stop polling
      if (isPollingPaused()) {
        stopPolling();
        return;
      }

      if (isVisible) {
        const inactiveDuration = lastInactiveTime ? Date.now() - lastInactiveTime : 0;
        // Only fetch if we've been inactive for a while and not rate limited
        if (inactiveDuration > 10000 && !isRateLimited()) {
          fetchLocalItems(true, type, 0, true);
        }
        lastInactiveTime = null;
      } else {
        lastInactiveTime = Date.now();
      }

      // Start or stop polling based on effective visibility (considering video player state)
      const effectivelyInactive = isEffectivelyInactive();
      if (!effectivelyInactive || shouldKeepFastPolling()) {
        startPolling();
      } else {
        stopPolling();
      }
    };

    // Initial polling start
    startPolling();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      if (cleanupInterval) clearInterval(cleanupInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchLocalItems, isRateLimited, type, pauseReasons]);

  // Return all data types and their setters
  return {
    loading,
    error,
    items,
    setItems,
    fetchItems,
  };
}
