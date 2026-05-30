import { useEffect, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePollingPauseStore, selectIsPaused } from '@/store/pollingPauseStore';
import { useBackendMode } from '@/hooks/useBackendMode';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { hasCachedDataForView } from '@/store/torboxDownloadsSelectors';
import {
  fetchDownloadType,
  fetchDownloadsForView,
  syncCanManualRefresh,
  peekRateLimited,
} from '@/store/torboxDownloadsFetch';
import {
  beginFetchInProgress,
  endFetchInProgress,
  getRateLimiter,
  isFetchInProgress,
  prevApiKeyRef,
  resetDownloadSyncRefs,
} from '@/store/torboxDownloadsRefs';
import { useDownloadListPolling } from '@/components/shared/hooks/useDownloadListPolling';
import { useAutomationTorrentEvents } from '@/components/shared/hooks/useAutomationTorrentEvents';

// Polling rules (intervals in pollingConfig.js + pollInterval.js):
// 1. 15s when the tab is visible/active, or during engagement grace after hide/idle
// 2. Disengaged + auto-start + queued torrents → 30s (torrents-only fetch on All tab)
// 3. Disengaged + auto-start + empty queue → 15min watch poll for new queue items
// 4. Disengaged without auto-start → polling stops
// 5. On the All tab while engaged, each tick fetches torrents, usenet, and webdl

export function useFetchData(apiKey, type = 'torrents') {
  const pollingPaused = usePollingPauseStore(selectIsPaused);
  const { mode: backendMode } = useBackendMode();

  const {
    loading,
    refreshing,
    error,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
  } = useTorboxDownloadsStore(
    useShallow((s) => ({
      loading: s.loading,
      refreshing: s.refreshing,
      error: s.error,
      lastSuccessfulFetchAt: s.lastSuccessfulFetchAt,
      refreshBlockedReason: s.refreshBlockedReason,
      pollSchedule: s.pollSchedule,
      canManualRefresh: s.canManualRefresh,
    }))
  );
  const dismissError = useTorboxDownloadsStore((s) => s.dismissError);
  const setPollSchedule = useTorboxDownloadsStore((s) => s.setPollSchedule);

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
        store.setCanManualRefresh(true);
      }
    }, 2000);
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
    let cancelled = false;

    if (!apiKey) {
      useTorboxDownloadsStore.getState().setLoading(false);
      endFetchInProgress(apiKey, type);
      return () => {
        cancelled = true;
      };
    }

    if (isFetchInProgress(apiKey, type)) {
      return () => {
        cancelled = true;
      };
    }

    beginFetchInProgress(apiKey, type);

    const hasCached = hasCachedDataForView(useTorboxDownloadsStore.getState(), type);

    const initialFetch = async () => {
      try {
        await fetchDownloadsForView(apiKey, type, { bypassCache: true, skipLoading: hasCached });
      } finally {
        if (cancelled) return;
        endFetchInProgress(apiKey, type);
        useTorboxDownloadsStore.getState().setLoading(false);
      }
    };

    initialFetch();

    return () => {
      cancelled = true;
      endFetchInProgress(apiKey, type);
    };
  }, [type, apiKey]);

  const fetchItems = useMemo(() => {
    return (bypassCache = true) => {
      if (!getRateLimiter().canManualRefresh(type)) {
        markRateLimited();
        return Promise.resolve([]);
      }

      return fetchDownloadsForView(apiKey, type, {
        bypassCache,
        skipLoading: true,
        manualRefresh: true,
      });
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
    refreshing,
    error,
    fetchItems,
    dismissError,
    lastSuccessfulFetchAt,
    refreshBlockedReason,
    pollSchedule,
    canManualRefresh,
  };
}
