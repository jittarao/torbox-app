import { mergeDownloadEntities } from '@/utils/downloadListMerge';
import { retryFetch } from '@/utils/retryFetch';
import { validateUserData } from '@/utils/monitoring';
import { perfMonitor } from '@/utils/performance';
import { isAutoStartWorkerActive } from '@/utils/autoStartWorkerClient';
import { fillAutoStartSlots } from '@/utils/torrentAutoStart';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getListKeyForAssetType } from '@/store/torboxDownloadsSelectors';
import { resetPollTimer } from '@/store/pollTimerReset';
import { POLLING_CONFIG } from '@/components/shared/hooks/pollingConfig';
import {
  listRevRef,
  getRateLimiter,
  prevApiKeyRef,
  abortStaleFetch,
} from '@/store/torboxDownloadsRefs';
function affectsCurrentView(activeType, viewType) {
  return (
    activeType === viewType ||
    (viewType === 'all' && ['torrents', 'usenet', 'webdl'].includes(activeType))
  );
}

function getErrorMessage(statusCode, activeType) {
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
  if (message && (message.includes('NetworkError') || message.includes('Failed to fetch'))) {
    return `Unable to connect to TorBox servers. ${activeType} data may not be up to date.`;
  }
  return `Failed to fetch ${activeType} data`;
}

function handleFetchError(
  fetchError,
  activeType,
  viewType,
  currentFetchId,
  skipLoading,
  responseStatus,
  manualRefresh = false
) {
  const store = useTorboxDownloadsStore.getState();
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

  const rateLimiter = getRateLimiter();
  if (
    currentFetchId === rateLimiter.getLatestFetchId(activeType) &&
    affectsCurrentView(activeType, viewType)
  ) {
    store.setError(getErrorMessage(statusCode || fetchError?.message, activeType));
  }

  if (!skipLoading) {
    store.setLoading(false);
  }
  if (manualRefresh) {
    store.setRefreshing(false);
  }
  return [];
}

/**
 * Fetch one asset type from TorBox API and update the store.
 *
 * List sync headers (mutually exclusive):
 * - manualRefresh | forceBypassCache → bypass-cache (blocking foreground refresh; manual UI or cache invalidation retry)
 * - forMutation → x-force-list-sync (post-mutation shallow refresh; 304/delta aware)
 *
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl'} activeType
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} viewType — active UI tab (poll scope + errors)
 * @param {{ retryCount?: number, skipLoading?: boolean, manualRefresh?: boolean, forMutation?: boolean, forceBypassCache?: boolean, mutationRetried?: boolean }} [options]
 */
export async function fetchDownloadType(
  apiKey,
  activeType,
  viewType,
  {
    retryCount = 0,
    skipLoading = false,
    manualRefresh = false,
    forMutation = false,
    forceBypassCache = false,
    mutationRetried = false,
  } = {}
) {
  const store = useTorboxDownloadsStore.getState();

  if (retryCount > 1) {
    console.error('Max retry attempts reached, giving up');
    if (!skipLoading) store.setLoading(false);
    if (manualRefresh) store.setRefreshing(false);
    return [];
  }

  if (!apiKey) {
    if (!skipLoading) store.setLoading(false);
    if (manualRefresh) store.setRefreshing(false);
    return [];
  }

  if (manualRefresh) {
    store.setRefreshing(true);
  } else if (!skipLoading) {
    store.setLoading(true);
  }

  const rateLimiter = getRateLimiter();
  const currentFetchId = rateLimiter.acquire(activeType, { forMutation });
  if (currentFetchId == null) {
    if (forMutation && !mutationRetried) {
      await new Promise((resolve) => setTimeout(resolve, POLLING_CONFIG.minIntervalBetweenCallsMs));
      return fetchDownloadType(apiKey, activeType, viewType, {
        retryCount,
        skipLoading,
        manualRefresh,
        forMutation,
        forceBypassCache,
        mutationRetried: true,
      });
    }

    console.warn(`Rate limit reached for ${activeType}, skipping fetch`);
    if (affectsCurrentView(activeType, viewType)) {
      store.markRateLimited();
    }
    if (!skipLoading) store.setLoading(false);
    if (manualRefresh) store.setRefreshing(false);
    return [];
  }

  const finishFetchFlags = () => {
    if (!skipLoading) store.setLoading(false);
    if (manualRefresh) store.setRefreshing(false);
  };

  const now = Date.now();
  const isLatestFetch = () =>
    rateLimiter.getLatestFetchId(activeType) === currentFetchId && prevApiKeyRef.current === apiKey;

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
  const rev = listRevRef.current[activeType];
  if (rev != null) {
    endpoint += `?rev=${encodeURIComponent(rev)}`;
  }

  try {
    if (!isLatestFetch()) {
      finishFetchFlags();
      return [];
    }

    const signal = abortStaleFetch(activeType);

    perfMonitor.startTimer(`fetch-${activeType}`);
    const useBypassCache = manualRefresh || forceBypassCache;
    const response = await fetch(endpoint, {
      signal,
      headers: {
        'x-api-key': apiKey,
        ...(useBypassCache && { 'bypass-cache': 'true' }),
        ...(!useBypassCache && forMutation && { 'x-force-list-sync': 'true' }),
        'Cache-Control': 'no-cache',
      },
    });

    if (response.status === 304) {
      const revHeader = response.headers.get('x-list-rev');
      if (revHeader != null && revHeader !== '') {
        listRevRef.current[activeType] = Number(revHeader);
      }

      perfMonitor.endTimer(`fetch-${activeType}`);

      if (!isLatestFetch() || signal.aborted) {
        finishFetchFlags();
        return [];
      }

      const assetType =
        activeType === 'usenet' ? 'usenet' : activeType === 'webdl' ? 'webdl' : 'torrents';
      const listKey = getListKeyForAssetType(assetType);
      const torboxState = useTorboxDownloadsStore.getState();
      const orderKeys = torboxState.order[listKey] || [];
      const sortedItems = orderKeys.map((key) => torboxState.entities[key]).filter(Boolean);

      if (affectsCurrentView(activeType, viewType)) {
        store.setError(null);
        store.markFetchSuccess();
        syncCanManualRefresh(viewType);
        resetPollTimer();
      }

      finishFetchFlags();
      return sortedItems;
    }

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
        viewType,
        currentFetchId,
        skipLoading,
        response.status,
        manualRefresh
      );
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      return handleFetchError(
        { message: `Failed to parse JSON: ${jsonError.message}` },
        activeType,
        viewType,
        currentFetchId,
        skipLoading,
        null,
        manualRefresh
      );
    }

    if (!isLatestFetch() || signal.aborted) {
      finishFetchFlags();
      return [];
    }

    perfMonitor.endTimer(`fetch-${activeType}`);

    const isDeltaPayload = data.success && data.delta === true;
    const isFullPayload = data.success && data.data && Array.isArray(data.data);

    if (isDeltaPayload || isFullPayload) {
      const payloadData = isDeltaPayload ? (Array.isArray(data.data) ? data.data : []) : data.data;

      if (!validateUserData(payloadData, apiKey)) {
        console.warn(
          `Invalid user data detected (attempt ${retryCount + 1}/2), retrying with cache bypass`
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchDownloadType(apiKey, activeType, viewType, {
          retryCount: retryCount + 1,
          skipLoading,
          manualRefresh,
          forceBypassCache: true,
        });
      }

      const assetType =
        activeType === 'usenet' ? 'usenet' : activeType === 'webdl' ? 'webdl' : 'torrents';
      const listKey = getListKeyForAssetType(assetType);
      const torboxState = useTorboxDownloadsStore.getState();
      const prevOrder = torboxState.order[listKey] || [];

      const { entities, orderKeys, filesCache } = mergeDownloadEntities(
        torboxState.entities,
        prevOrder,
        {
          delta: isDeltaPayload,
          data: payloadData,
          ...(isDeltaPayload && { removed: data.removed }),
        },
        assetType,
        torboxState.filesByEntityKey
      );

      const sortedItems = orderKeys.map((key) => entities[key]).filter(Boolean);

      const nextRev =
        data.rev ??
        (() => {
          const revHeader = response.headers.get('x-list-rev');
          return revHeader != null && revHeader !== '' ? Number(revHeader) : null;
        })();
      if (nextRev != null && Number.isInteger(nextRev)) {
        listRevRef.current[activeType] = nextRev;
      }

      if (!isLatestFetch() || signal.aborted) {
        finishFetchFlags();
        return [];
      }

      store.setListFromMerge(assetType, entities, orderKeys, filesCache);

      if (listKey === 'torrents' && !isAutoStartWorkerActive()) {
        try {
          await fillAutoStartSlots(sortedItems, apiKey, { viewType });
        } catch (autoStartError) {
          console.error('Error filling auto-start slots:', autoStartError);
        }
      }

      if (affectsCurrentView(activeType, viewType)) {
        store.setError(null);
        store.markFetchSuccess();
        syncCanManualRefresh(viewType);
        resetPollTimer();
      }

      finishFetchFlags();

      return sortedItems;
    }

    if (data.success && data.data && Array.isArray(data.data) && data.data.length === 0) {
      if (affectsCurrentView(activeType, viewType)) {
        store.markFetchSuccess();
        resetPollTimer();
      }
      finishFetchFlags();
      return [];
    }

    if (Object.keys(data).length === 0) {
      console.warn(`Backend returned empty response for ${activeType} data`);
    } else {
      console.warn(`Invalid ${activeType} data format:`, data);
    }

    finishFetchFlags();
    return [];
  } catch (err) {
    if (err?.name === 'AbortError') {
      finishFetchFlags();
      return [];
    }
    return handleFetchError(
      err,
      activeType,
      viewType,
      currentFetchId,
      skipLoading,
      null,
      manualRefresh
    );
  }
}

/**
 * @param {string} apiKey
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} viewType
 * @param {{ skipLoading?: boolean, manualRefresh?: boolean, retryCount?: number }} [options]
 */
export async function fetchDownloadsForView(
  apiKey,
  viewType,
  { skipLoading = false, retryCount = 0, manualRefresh = false } = {}
) {
  const store = useTorboxDownloadsStore.getState();

  if (viewType === 'all') {
    if (manualRefresh) {
      store.setRefreshing(true);
    } else if (!skipLoading) {
      store.setLoading(true);
    }

    try {
      const results = await Promise.allSettled([
        fetchDownloadType(apiKey, 'torrents', viewType, {
          retryCount,
          skipLoading: true,
          manualRefresh,
        }),
        fetchDownloadType(apiKey, 'usenet', viewType, {
          retryCount,
          skipLoading: true,
          manualRefresh,
        }),
        fetchDownloadType(apiKey, 'webdl', viewType, {
          retryCount,
          skipLoading: true,
          manualRefresh,
        }),
      ]);

      return results.map((r) => (r.status === 'fulfilled' ? r.value : [])).flat();
    } finally {
      if (!skipLoading) {
        store.setLoading(false);
      }
      if (manualRefresh) {
        store.setRefreshing(false);
      }
    }
  }

  const activeType = viewType === 'usenet' ? 'usenet' : viewType === 'webdl' ? 'webdl' : 'torrents';
  return fetchDownloadType(apiKey, activeType, viewType, {
    retryCount,
    skipLoading,
    manualRefresh,
  });
}

export function syncCanManualRefresh(viewType) {
  const allowed = getRateLimiter().canManualRefresh(viewType);
  useTorboxDownloadsStore.getState().setCanManualRefresh(allowed);
  return allowed;
}

export function peekRateLimited(activeType) {
  return getRateLimiter().peekWouldBlock(activeType);
}
