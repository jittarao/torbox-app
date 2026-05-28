import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import { useBackendModeStore } from '@/store/backendModeStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectItemsForView, hasCachedDataForView } from '@/store/torboxDownloadsSelectors';
import {
  fetchDownloadType,
  fetchDownloadsForView,
  syncCanManualRefresh,
  peekRateLimited,
} from '@/store/torboxDownloadsFetch';
import {
  fetchInProgressRef,
  getRateLimiter,
  prevApiKeyRef,
  resetDownloadSyncRefs,
} from '@/store/torboxDownloadsRefs';
import { useDownloadListPolling } from './useDownloadListPolling';
import { useAutomationTorrentEvents } from './useAutomationTorrentEvents';

// Polling rules (intervals in pollingConfig.js):
// 1. 15s polling when the browser tab is focused and refresh is not paused
// 2. 60s polling for hiddenGracePeriodMs after the tab is hidden, then stop (unless rule 3)
// 3. 60s polling while hidden when auto-start is on and queued torrents exist (torrents or All tab)
// 4. On the All tab, fetches torrents, usenet, and webdl on each poll tick

export function useFetchData(apiKey, type = 'torrents') {
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
  const backendMode = useBackendModeStore((state) => state.mode);

  const {
    loading,
    error,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
    torrents,
    dismissError,
    setPollSchedule,
  } = useTorboxDownloadsStore(
    useShallow((s) => ({
      loading: s.loading,
      error: s.error,
      lastSuccessfulFetchAt: s.lastSuccessfulFetchAt,
      refreshBlockedReason: s.refreshBlockedReason,
      pollSchedule: s.pollSchedule,
      canManualRefresh: s.canManualRefresh,
      torrents: s.torrents,
      dismissError: s.dismissError,
      setPollSchedule: s.setPollSchedule,
    }))
  );

  const items = useTorboxDownloadsStore(useCallback((s) => selectItemsForView(s, type), [type]));

  const torrentsRef = useRef(torrents);
  useEffect(() => {
    torrentsRef.current = torrents;
  }, [torrents]);

  const syncManualRefreshAllowed = useCallback(() => {
    syncCanManualRefresh(type);
  }, [type]);

  useEffect(() => {
    const id = setInterval(() => {
      getRateLimiter().prune();
      syncManualRefreshAllowed();
      const store = useTorboxDownloadsStore.getState();
      if (
        store.refreshBlockedReason === 'rate_limited' &&
        getRateLimiter().canManualRefresh(type)
      ) {
        store.setRefreshBlockedReason(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [type, syncManualRefreshAllowed]);

  useEffect(() => {
    syncManualRefreshAllowed();
  }, [syncManualRefreshAllowed]);

  const markRateLimited = useCallback(() => {
    useTorboxDownloadsStore.getState().markRateLimited();
  }, []);

  const isRateLimited = useCallback(
    (activeType = type) => peekRateLimited(activeType),
    [type]
  );

  useEffect(() => {
    if (prevApiKeyRef.current !== apiKey) {
      resetDownloadSyncRefs(apiKey);
      useTorboxDownloadsStore.getState().resetForApiKey(!!apiKey);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) {
      useTorboxDownloadsStore.getState().setLoading(false);
      fetchInProgressRef.current = false;
      return;
    }

    if (fetchInProgressRef.current) {
      return;
    }

    fetchInProgressRef.current = true;

    const hasCached = hasCachedDataForView(useTorboxDownloadsStore.getState(), type);

    const initialFetch = async () => {
      try {
        await fetchDownloadsForView(apiKey, type, { bypassCache: true, skipLoading: hasCached });
      } finally {
        fetchInProgressRef.current = false;
        useTorboxDownloadsStore.getState().setLoading(false);
      }
    };

    initialFetch();
  }, [type, apiKey]);

  const setItems = useMemo(() => {
    const store = useTorboxDownloadsStore.getState;

    switch (type) {
      case 'all':
        return (newItemsOrUpdater) => {
          if (typeof newItemsOrUpdater === 'function') {
            const updater = newItemsOrUpdater;
            store().updateList('torrents', (prev) => updater(prev || []));
            store().updateList('usenet', (prev) => updater(prev || []));
            store().updateList('webdl', (prev) => updater(prev || []));
          } else if (Array.isArray(newItemsOrUpdater)) {
            const list = newItemsOrUpdater;
            store().setTorrents(list.filter((item) => item.assetType === 'torrents'));
            store().setUsenet(list.filter((item) => item.assetType === 'usenet'));
            store().setWebdl(list.filter((item) => item.assetType === 'webdl'));
          } else {
            console.warn('setItems called with non-array and non-function:', newItemsOrUpdater);
          }
        };
      case 'usenet':
        return (updater) => {
          if (typeof updater === 'function') {
            store().updateList('usenet', updater);
          } else {
            store().setUsenet(updater);
          }
        };
      case 'webdl':
        return (updater) => {
          if (typeof updater === 'function') {
            store().updateList('webdl', updater);
          } else {
            store().setWebdl(updater);
          }
        };
      default:
        return (updater) => {
          if (typeof updater === 'function') {
            store().updateList('torrents', updater);
          } else {
            store().setTorrents(updater);
          }
        };
    }
  }, [type]);

  const fetchItems = useMemo(() => {
    return (bypassCache = true) => {
      if (!getRateLimiter().canManualRefresh(type)) {
        markRateLimited();
        return Promise.resolve([]);
      }

      return fetchDownloadsForView(apiKey, type, { bypassCache, skipLoading: true });
    };
  }, [type, apiKey, markRateLimited]);

  const handlePoll = useCallback(
    (assetType, bypassCache = false) => {
      fetchDownloadType(apiKey, assetType, type, { bypassCache, skipLoading: true });
    },
    [apiKey, type]
  );

  const handlePollScheduleUpdate = useCallback(
    (schedule) => {
      setPollSchedule(schedule);
    },
    [setPollSchedule]
  );

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
    onTorrentsChanged: (bypassCache) =>
      fetchDownloadType(apiKey, 'torrents', type, { bypassCache, skipLoading: true }),
  });

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
    canManualRefresh,
  };
}
