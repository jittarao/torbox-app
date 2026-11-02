import { useEffect, useState } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { POLLING_CONFIG } from '@/components/shared/hooks/pollingConfig';
import {
  configureAutoStartWorker,
  getLastAutoStartResult,
  stopAutoStartWorker,
  subscribeAutoStartWorkerResults,
} from '@/utils/autoStartWorkerClient';
import { scheduleForceStartReconcile } from '@/store/downloadListReconcile';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';

/** Auto Start setting from the torrent upload options, kept in sync across windows. */
function useAutoStartOptions() {
  const [autoStartEnabled, setAutoStartEnabled] = useState(
    () => getAutoStartOptions()?.autoStart ?? false
  );
  const [autoStartLimit, setAutoStartLimit] = useState(
    () => getAutoStartOptions()?.autoStartLimit ?? 3
  );

  useEffect(() => {
    const syncOptions = () => {
      const options = getAutoStartOptions();
      setAutoStartEnabled(options?.autoStart ?? false);
      setAutoStartLimit(options?.autoStartLimit ?? 3);
    };

    syncOptions();
    window.addEventListener('storage', syncOptions);
    window.addEventListener('torrent-upload-options', syncOptions);
    return () => {
      window.removeEventListener('storage', syncOptions);
      window.removeEventListener('torrent-upload-options', syncOptions);
    };
  }, []);

  return { autoStartEnabled, autoStartLimit };
}

/**
 * Drive the SharedWorker auto-start loop while Auto Start is enabled. Mounted in the app shell:
 * the worker fetches its own torrent list, so it must not depend on which page or tab is open.
 *
 * @param {Object} options
 * @param {string | null | undefined} options.apiKey
 */
export function useAutoStartWorker({ apiKey }) {
  const { autoStartEnabled, autoStartLimit } = useAutoStartOptions();
  const autoStartApplies = autoStartEnabled && !!apiKey;

  useEffect(() => {
    if (!autoStartApplies) {
      stopAutoStartWorker();
      return;
    }

    configureAutoStartWorker({
      enabled: true,
      apiKey,
      limit: autoStartLimit,
      queuedIntervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
      watchIntervalMs: POLLING_CONFIG.autoStartWatchIntervalMs,
      betweenStartsMs: POLLING_CONFIG.autoStartBetweenStartsMs,
      processedTtlMs: POLLING_CONFIG.autoStartProcessedTtlMs,
      requestTimeoutMs: POLLING_CONFIG.autoStartRequestTimeoutMs,
      livenessIntervalMs: POLLING_CONFIG.autoStartLivenessIntervalMs,
    });

    return () => {
      stopAutoStartWorker();
    };
  }, [apiKey, autoStartApplies, autoStartLimit]);

  useEffect(() => {
    if (!autoStartApplies) return;

    return subscribeAutoStartWorkerResults((result) => {
      if (result.startedIds.length > 0) {
        scheduleForceStartReconcile('torrents');
      }
    });
  }, [autoStartApplies]);
}

/**
 * Whether auto-start has work on a torrent view, for the screen wake lock.
 *
 * @param {Object} options
 * @param {string | null | undefined} options.apiKey
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} options.viewType
 */
export function useAutoStartViewStatus({ apiKey, viewType }) {
  const { autoStartEnabled, autoStartLimit } = useAutoStartOptions();
  const hasQueuedTorrents = useTorboxDownloadsStore((s) => selectHasQueuedTorrents(s));

  const autoStartApplies =
    autoStartEnabled && (viewType === 'torrents' || viewType === 'all') && !!apiKey;

  const lastResult = getLastAutoStartResult();
  const hasWork =
    hasQueuedTorrents ||
    (lastResult?.queuedCount ?? 0) > 0 ||
    (lastResult?.activeCount ?? 0) < autoStartLimit;

  return { autoStartApplies, hasWork };
}
