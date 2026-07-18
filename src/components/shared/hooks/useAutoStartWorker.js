import { useEffect, useRef, useState } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { POLLING_CONFIG } from '@/components/shared/hooks/pollingConfig';
import {
  configureAutoStartWorker,
  isAutoStartWorkerActive,
  stopAutoStartWorker,
  subscribeAutoStartWorkerResults,
  subscribeAutoStartWorkerState,
} from '@/utils/autoStartWorkerClient';
import { scheduleForceStartReconcile } from '@/store/downloadListReconcile';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';

/**
 * Drive the SharedWorker auto-start loop while Auto Start is enabled on torrents/all.
 *
 * @param {Object} options
 * @param {string | null | undefined} options.apiKey
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} options.viewType
 */
export function useAutoStartWorker({ apiKey, viewType }) {
  const [autoStartEnabled, setAutoStartEnabled] = useState(
    () => getAutoStartOptions()?.autoStart ?? false
  );
  const [autoStartLimit, setAutoStartLimit] = useState(
    () => getAutoStartOptions()?.autoStartLimit ?? 3
  );
  const [workerActive, setWorkerActive] = useState(() => isAutoStartWorkerActive());
  const hasQueuedTorrents = useTorboxDownloadsStore((s) => selectHasQueuedTorrents(s));
  const lastResultRef = useRef({ queuedCount: 0, activeCount: 0 });

  const autoStartApplies =
    autoStartEnabled && (viewType === 'torrents' || viewType === 'all') && !!apiKey;

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

  useEffect(() => {
    return subscribeAutoStartWorkerState(() => {
      setWorkerActive(isAutoStartWorkerActive());
    });
  }, []);

  useEffect(() => {
    if (!autoStartApplies) {
      stopAutoStartWorker();
      setWorkerActive(false);
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
    });

    return () => {
      stopAutoStartWorker();
      setWorkerActive(false);
    };
  }, [apiKey, autoStartApplies, autoStartLimit]);

  useEffect(() => {
    if (!autoStartApplies) return;

    return subscribeAutoStartWorkerResults((result) => {
      lastResultRef.current = {
        queuedCount: result.queuedCount,
        activeCount: result.activeCount,
      };

      if (result.startedIds.length > 0) {
        scheduleForceStartReconcile('torrents');
      }
    });
  }, [autoStartApplies]);

  const hasWork =
    hasQueuedTorrents ||
    lastResultRef.current.queuedCount > 0 ||
    lastResultRef.current.activeCount < autoStartLimit;

  return {
    workerActive: workerActive && autoStartApplies,
    autoStartApplies,
    hasWork,
  };
}
