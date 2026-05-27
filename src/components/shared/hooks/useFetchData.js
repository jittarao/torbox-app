import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { isQueuedItem, getAutoStartOptions, sortItems } from '@/utils/utility';
import { retryFetch } from '@/utils/retryFetch';
import { validateUserData } from '@/utils/monitoring';
import { perfMonitor } from '@/utils/performance';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useBackendModeStore } from '@/store/backendModeStore';
import { POLLING_CONFIG } from './pollingConfig';
import { useDownloadListPolling } from './useDownloadListPolling';
import { useAutomationTorrentEvents } from './useAutomationTorrentEvents';

const { maxCalls: MAX_CALLS, windowSizeMs: WINDOW_SIZE, minIntervalBetweenCallsMs: MIN_INTERVAL_BETWEEN_CALLS, minIntervalByType: MIN_INTERVAL_MAPPING, autoStartCheckIntervalMs: AUTO_START_CHECK_INTERVAL } =
  POLLING_CONFIG;

// Polling rules (intervals in pollingConfig.js):
// 1. 15s polling when the browser tab is focused and refresh is not paused
// 2. 60s polling when hidden AND auto-start is on AND queued torrents exist (torrents or All tab)
// 3. No polling when hidden without that auto-start condition
// 4. On the All tab, fetches torrents, usenet, and webdl on each poll tick

function affectsCurrentView(activeType, viewType) {
  return (
    activeType === viewType ||
    (viewType === 'all' && ['torrents', 'usenet', 'webdl'].includes(activeType))
  );
}

function hasCachedDataForType(viewType, torrentsRef, usenetRef, webdlRef) {
  switch (viewType) {
    case 'all':
      return (
        (torrentsRef.current?.length || 0) +
          (usenetRef.current?.length || 0) +
          (webdlRef.current?.length || 0) >
        0
      );
    case 'usenet':
      return (usenetRef.current?.length || 0) > 0;
    case 'webdl':
      return (webdlRef.current?.length || 0) > 0;
    default:
      return (torrentsRef.current?.length || 0) > 0;
  }
}

export function useFetchData(apiKey, type = 'torrents') {
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
  const backendMode = useBackendModeStore((state) => state.mode);
  const [torrents, setTorrents] = useState([]);
  const [usenetItems, setUsenetItems] = useState([]);
  const [webdlItems, setWebdlItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSuccessfulFetchAt, setLastSuccessfulFetchAt] = useState(null);
  const [refreshBlockedReason, setRefreshBlockedReason] = useState(null);
  const [pollSchedule, setPollSchedule] = useState(null);
  const torrentsRef = useRef([]);
  const usenetRef = useRef([]);
  const webdlRef = useRef([]);
  const lastAutoStartCheckRef = useRef(0);
  const processedQueueIdsRef = useRef(new Set());
  const fetchInProgressRef = useRef(false);
  const deltaCursorRef = useRef({ torrents: null, usenet: null, webdl: null });
  const prevApiKeyRef = useRef(apiKey);
  const rateLimitDataRef = useRef({});

  useEffect(() => {
    torrentsRef.current = torrents;
  }, [torrents]);

  useEffect(() => {
    usenetRef.current = usenetItems;
  }, [usenetItems]);

  useEffect(() => {
    webdlRef.current = webdlItems;
  }, [webdlItems]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      for (const key of Object.keys(rateLimitDataRef.current)) {
        const rateData = rateLimitDataRef.current[key];
        if (rateData) {
          rateData.callTimestamps = rateData.callTimestamps
            .filter((timestamp) => now - timestamp < WINDOW_SIZE)
            .slice(-MAX_CALLS);
        }
      }
    }, WINDOW_SIZE);
    return () => clearInterval(id);
  }, []);

  const markFetchSuccess = useCallback(() => {
    setLastSuccessfulFetchAt(Date.now());
    setRefreshBlockedReason(null);
  }, []);

  const markRateLimited = useCallback(() => {
    setRefreshBlockedReason('rate_limited');
  }, []);

  const isRateLimited = useCallback((activeType = type) => {
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
    rateData.callTimestamps = rateData.callTimestamps
      .filter((timestamp) => now - timestamp < WINDOW_SIZE)
      .slice(-MAX_CALLS);
    return rateData.callTimestamps.length >= MAX_CALLS;
  }, [type]);

  const pruneProcessedQueueIds = useCallback((items) => {
    const queuedIds = new Set(items.filter(isQueuedItem).map((item) => item.id));
    for (const id of processedQueueIdsRef.current) {
      if (!queuedIds.has(id)) {
        processedQueueIdsRef.current.delete(id);
      }
    }
  }, []);

  const checkAndAutoStartTorrents = useCallback(
    async (items) => {
      if (type !== 'torrents' && type !== 'all') return;

      try {
        const options = getAutoStartOptions();
        if (!options?.autoStart) return;

        pruneProcessedQueueIds(items);

        const activeCount = items.filter((item) => item.active).length;
        const queuedItems = items.filter(isQueuedItem);

        if (activeCount < options.autoStartLimit && queuedItems.length > 0) {
          const queuedId = queuedItems[0].id;
          if (processedQueueIdsRef.current.has(queuedId)) return;

          processedQueueIdsRef.current.add(queuedId);

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
      } catch (autoStartError) {
        console.error('Error in auto-start check:', autoStartError);
      }
    },
    [apiKey, type, pruneProcessedQueueIds]
  );

  const getErrorMessage = useCallback((statusCode, activeType) => {
    const status = typeof statusCode === 'number' ? statusCode : null;
    const message = typeof statusCode === 'string' ? statusCode : null;

    if (status === 502) {
      return `TorBox servers are temporarily unavailable. ${activeType} data may not be up to date.`;
    }
    if (status === 503) {
      return `TorBox servers are temporarily overloaded. ${activeType} data may not be up to date.`;
    }
    if (status === 504) {
      return `TorBox servers are taking too long to respond. ${activeType} data may not be up to date.`;
    }
    if (status === 401) {
      return 'Authentication failed. Please check your API key.';
    }
    if (status === 403) {
      return 'Access denied. Please check your API key and account status.';
    }
    if (status === 429) {
      return 'Too many requests to TorBox servers. Please wait a moment.';
    }
    if (
      message &&
      (message.includes('NetworkError') || message.includes('Failed to fetch'))
    ) {
      return `Unable to connect to TorBox servers. ${activeType} data may not be up to date.`;
    }
    return `Failed to fetch ${activeType} data`;
  }, []);

  const handleFetchError = useCallback(
    (fetchError, activeType, currentFetchId, rateData, skipLoading, responseStatus = null) => {
      perfMonitor.endTimer(`fetch-${activeType}`);

      const statusCode =
        responseStatus ||
        (fetchError?.message?.match(/\d{3}/)?.[0]
          ? parseInt(fetchError.message.match(/\d{3}/)[0], 10)
          : null);
      const errorMessage =
        fetchError?.error ||
        fetchError?.message ||
        `Error fetching ${activeType} data${statusCode ? `: ${statusCode}` : ''}`;

      if (statusCode && statusCode >= 500) {
        console.warn(`Backend error fetching ${activeType} data (${statusCode}):`, errorMessage);
      } else {
        console.warn(
          `Error fetching ${activeType} data${statusCode ? ` (${statusCode})` : ''}:`,
          errorMessage
        );
      }

      if (
        currentFetchId === rateData.latestFetchId &&
        affectsCurrentView(activeType, type)
      ) {
        setError(getErrorMessage(statusCode || fetchError?.message, activeType));
      }

      if (!skipLoading) {
        setLoading(false);
      }
      return [];
    },
    [type, getErrorMessage]
  );

  const fetchLocalItems = useCallback(
    async (bypassCache = false, customType = null, retryCount = 0, skipLoading = false) => {
      const activeType = customType || type;

      if (retryCount > 1) {
        console.error('Max retry attempts reached, giving up');
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      if (!apiKey) {
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      if (!skipLoading) {
        setLoading(true);
      }

      if (activeType === 'all') {
        const results = await Promise.allSettled([
          fetchLocalItems(bypassCache, 'torrents', retryCount, true),
          fetchLocalItems(bypassCache, 'usenet', retryCount, true),
          fetchLocalItems(bypassCache, 'webdl', retryCount, true),
        ]);

        const flattenedResults = results
          .map((result) => (result.status === 'fulfilled' ? result.value : []))
          .flat();

        if (!skipLoading) {
          setLoading(false);
        }
        return flattenedResults;
      }

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
        if (affectsCurrentView(activeType, type)) {
          markRateLimited();
        }
        if (!skipLoading) {
          setLoading(false);
        }
        return [];
      }

      const now = Date.now();
      rateData.lastFetchTime = now;
      rateData.callTimestamps.push(now);
      const currentFetchId = ++rateData.latestFetchId;
      const isLatestFetch = () => {
        const latestRateData = rateLimitDataRef.current[activeType];
        return (
          latestRateData &&
          latestRateData.latestFetchId === currentFetchId &&
          prevApiKeyRef.current === apiKey
        );
      };

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
      const cursor = deltaCursorRef.current[activeType];
      if (cursor) {
        endpoint += `?delta=1&cursor=${encodeURIComponent(cursor)}`;
      }

      try {
        if (!isLatestFetch()) {
          if (!skipLoading) setLoading(false);
          return [];
        }
        perfMonitor.startTimer(`fetch-${activeType}`);
        const response = await fetch(endpoint, {
          headers: {
            'x-api-key': apiKey,
            ...(bypassCache && { 'bypass-cache': 'true' }),
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          let errorData = {};
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              errorData = await response.json();
            }
          } catch {
            // ignore parse errors
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

        if (!isLatestFetch()) {
          return [];
        }

        perfMonitor.endTimer(`fetch-${activeType}`);

        if (data.success && data.data && Array.isArray(data.data)) {
          if (!validateUserData(data.data, apiKey)) {
            console.warn(
              `Invalid user data detected (attempt ${retryCount + 1}/2), retrying with cache bypass`
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return fetchLocalItems(true, customType, retryCount + 1, skipLoading);
          }

          const assetType =
            activeType === 'usenet' ? 'usenet' : activeType === 'webdl' ? 'webdl' : 'torrents';
          let sortedItems;

          if (data.delta === true) {
            const removedSet = new Set(data.removed || []);
            const currentList =
              activeType === 'usenet'
                ? usenetRef.current
                : activeType === 'webdl'
                  ? webdlRef.current
                  : torrentsRef.current;
            let list = (currentList || []).filter((item) => !removedSet.has(item.id));
            for (const item of data.data) {
              const withType = { ...item, assetType };
              const idx = list.findIndex((i) => i.id === item.id);
              if (idx >= 0) {
                list[idx] = withType;
              } else {
                list.push(withType);
              }
            }
            sortedItems = sortItems(list);
          } else {
            sortedItems = sortItems(data.data);
          }

          if (data.cursor) {
            deltaCursorRef.current[activeType] = data.cursor;
          }

          if (!isLatestFetch()) {
            return [];
          }

          switch (activeType) {
            case 'usenet':
              setUsenetItems(sortedItems.map((item) => ({ ...item, assetType: 'usenet' })));
              break;
            case 'webdl':
              setWebdlItems(sortedItems.map((item) => ({ ...item, assetType: 'webdl' })));
              break;
            default:
              setTorrents(sortedItems.map((item) => ({ ...item, assetType: 'torrents' })));
              if (now - lastAutoStartCheckRef.current >= AUTO_START_CHECK_INTERVAL) {
                await checkAndAutoStartTorrents(sortedItems);
                lastAutoStartCheckRef.current = now;
              }
          }

          if (affectsCurrentView(activeType, type)) {
            setError(null);
            markFetchSuccess();
          }

          if (!skipLoading) {
            setLoading(false);
          }

          return sortedItems;
        }

        if (data.success && data.data && Array.isArray(data.data) && data.data.length === 0) {
          if (affectsCurrentView(activeType, type)) {
            markFetchSuccess();
          }
          if (!skipLoading) {
            setLoading(false);
          }
          return [];
        }

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
    [
      apiKey,
      checkAndAutoStartTorrents,
      isRateLimited,
      type,
      handleFetchError,
      markFetchSuccess,
      markRateLimited,
    ]
  );

  const items = useMemo(() => {
    switch (type) {
      case 'all':
        return [...(torrents || []), ...(usenetItems || []), ...(webdlItems || [])];
      case 'usenet':
        return usenetItems || [];
      case 'webdl':
        return webdlItems || [];
      default:
        return torrents || [];
    }
  }, [type, torrents, usenetItems, webdlItems]);

  useEffect(() => {
    if (prevApiKeyRef.current !== apiKey) {
      prevApiKeyRef.current = apiKey;
      deltaCursorRef.current = { torrents: null, usenet: null, webdl: null };
      rateLimitDataRef.current = {};
      processedQueueIdsRef.current = new Set();
      fetchInProgressRef.current = false;
      setTorrents([]);
      setUsenetItems([]);
      setWebdlItems([]);
      setLoading(!!apiKey);
      setError(null);
      setLastSuccessfulFetchAt(null);
      setRefreshBlockedReason(null);
      setPollSchedule(null);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      fetchInProgressRef.current = false;
      return;
    }

    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    const hasCached = hasCachedDataForType(type, torrentsRef, usenetRef, webdlRef);

    const initialFetch = async () => {
      try {
        await fetchLocalItems(true, type, 0, hasCached);
      } finally {
        fetchInProgressRef.current = false;
        setLoading(false);
      }
    };

    initialFetch();
  }, [type, apiKey, fetchLocalItems]);

  const setItems = useMemo(() => {
    switch (type) {
      case 'all':
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
  }, [type]);

  const fetchItems = useMemo(() => {
    return (bypassCache = true) => {
      switch (type) {
        case 'all':
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

  const handlePoll = useCallback(
    (assetType, bypassCache = false) => {
      fetchLocalItems(bypassCache, assetType, 0, true);
    },
    [fetchLocalItems]
  );

  const handlePollScheduleUpdate = useCallback((schedule) => {
    setPollSchedule(schedule);
  }, []);

  useDownloadListPolling({
    type,
    pollingPaused,
    torrentsRef,
    onPoll: handlePoll,
    isRateLimited,
    onPollSkipped: markRateLimited,
    onScheduleUpdate: handlePollScheduleUpdate,
  });

  useAutomationTorrentEvents({
    enabled: backendMode === 'backend' && !!apiKey && (type === 'torrents' || type === 'all'),
    apiKey,
    onTorrentsChanged: (bypassCache) => fetchLocalItems(bypassCache, 'torrents', 0, true),
  });

  const dismissError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    items,
    setItems,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
  };
}
