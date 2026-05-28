import { useEffect, useRef } from 'react';
import { isQueuedItem, getAutoStartOptions } from '@/utils/utility';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectItemsForView } from '@/store/torboxDownloadsSelectors';
import { POLLING_CONFIG } from './pollingConfig';
import { createPollSchedule } from './pollSchedule';

const ALL_ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

/**
 * Visibility-aware polling for download lists.
 *
 * @param {Object} options
 * @param {string} options.type - Active view type: torrents | usenet | webdl | all
 * @param {boolean} options.pollingPaused - True when any pause reason is active
 * @param {(assetType: string, bypassCache?: boolean) => void | Promise<void>} options.onPoll - Per-type fetch
 * @param {(assetType?: string) => boolean} options.isRateLimited
 * @param {() => void} [options.onPollSkipped] - Called when a tick is skipped due to rate limiting
 * @param {(schedule: import('./pollSchedule').PollSchedule) => void} [options.onScheduleUpdate] - Poll timer state for UI
 */
export function useDownloadListPolling({
  type,
  pollingPaused,
  onPoll,
  isRateLimited,
  onPollSkipped,
  onScheduleUpdate,
}) {
  /** Restart hidden-tab queue polling when queued torrents appear/disappear (not on every list length change). */
  const needsQueuedTorrentPoll = useTorboxDownloadsStore((s) => {
    if (type !== 'torrents' && type !== 'all') return false;
    const options = getAutoStartOptions();
    if (!options?.autoStart) return false;
    const order = s.order?.torrents;
    if (!order?.length) return false;
    const entities = s.entities || {};
    for (let i = 0; i < order.length; i++) {
      const row = entities[order[i]];
      if (row && isQueuedItem(row)) return true;
    }
    return false;
  });

  const onPollRef = useRef(onPoll);
  const isRateLimitedRef = useRef(isRateLimited);
  const onPollSkippedRef = useRef(onPollSkipped);
  const onScheduleUpdateRef = useRef(onScheduleUpdate);

  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  useEffect(() => {
    isRateLimitedRef.current = isRateLimited;
  }, [isRateLimited]);

  useEffect(() => {
    onPollSkippedRef.current = onPollSkipped;
  }, [onPollSkipped]);

  useEffect(() => {
    onScheduleUpdateRef.current = onScheduleUpdate;
  }, [onScheduleUpdate]);

  useEffect(() => {
    let pollTimeoutId = null;
    let graceStopTimeoutId = null;
    let wasTabHidden = false;
    let hiddenSince = null;
    let isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    let currentPollingInterval = POLLING_CONFIG.activeIntervalMs;
    let cancelled = false;

    if (!isVisible) {
      hiddenSince = Date.now();
    }

    const clearGraceStopTimeout = () => {
      if (graceStopTimeoutId) {
        clearTimeout(graceStopTimeoutId);
        graceStopTimeoutId = null;
      }
    };

    const isWithinHiddenGracePeriod = () => {
      if (isVisible || hiddenSince == null) return false;
      return Date.now() - hiddenSince < POLLING_CONFIG.hiddenGracePeriodMs;
    };

    const shouldPollForAutoStartQueued = () => {
      if (type !== 'torrents' && type !== 'all') return false;
      const options = getAutoStartOptions();
      const torrents = selectItemsForView(useTorboxDownloadsStore.getState(), 'torrents');
      return Boolean(options?.autoStart && torrents.some(isQueuedItem));
    };

    const shouldPollWhileHidden = () => {
      if (pollingPaused) return false;
      return isWithinHiddenGracePeriod() || shouldPollForAutoStartQueued();
    };

    const isEffectivelyInactive = () => pollingPaused || !isVisible;

    const getScheduleMode = () => {
      if (pollingPaused) return 'paused';
      if (!isVisible) {
        return shouldPollWhileHidden() ? 'slow' : 'inactive';
      }
      return 'active';
    };

    const emitSchedule = (delayMs, mode = getScheduleMode()) => {
      const nextPollAt = delayMs > 0 ? Date.now() + delayMs : null;
      onScheduleUpdateRef.current?.(
        createPollSchedule(mode, nextPollAt, delayMs > 0 ? delayMs : currentPollingInterval)
      );
    };

    const pollAllAssetTypes = (bypassCache) => {
      let anySkipped = false;
      for (const assetType of ALL_ASSET_TYPES) {
        if (isRateLimitedRef.current(assetType)) {
          anySkipped = true;
        } else {
          onPollRef.current(assetType, bypassCache);
        }
      }
      if (anySkipped) {
        onPollSkippedRef.current?.();
      }
    };

    const runPollTick = (bypassCache = false) => {
      if (type === 'all') {
        pollAllAssetTypes(bypassCache);
        return;
      }

      if (isRateLimitedRef.current(type)) {
        onPollSkippedRef.current?.();
        return;
      }
      onPollRef.current(type, bypassCache);
    };

    const scheduleNextPoll = (delayMs) => {
      if (cancelled) return;
      emitSchedule(delayMs);
      pollTimeoutId = setTimeout(() => {
        if (cancelled) return;
        const effectivelyInactive = isEffectivelyInactive();
        if (!effectivelyInactive || shouldPollWhileHidden()) {
          runPollTick(false);
        }
        const interval = !effectivelyInactive
          ? POLLING_CONFIG.activeIntervalMs
          : shouldPollWhileHidden()
            ? POLLING_CONFIG.inactiveIntervalMs
            : currentPollingInterval;
        currentPollingInterval = interval;
        if (!effectivelyInactive || shouldPollWhileHidden()) {
          scheduleNextPoll(interval);
        } else {
          emitSchedule(0, 'inactive');
        }
      }, delayMs);
    };

    const stopPolling = () => {
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
      clearGraceStopTimeout();
      emitSchedule(0, getScheduleMode());
    };

    const scheduleGraceStop = () => {
      clearGraceStopTimeout();
      if (isVisible || hiddenSince == null || !isWithinHiddenGracePeriod()) return;

      const remainingMs = hiddenSince + POLLING_CONFIG.hiddenGracePeriodMs - Date.now();
      if (remainingMs <= 0) return;

      graceStopTimeoutId = setTimeout(() => {
        graceStopTimeoutId = null;
        if (cancelled || isVisible) return;
        if (shouldPollWhileHidden()) return;
        stopPolling();
      }, remainingMs);
    };

    const startPolling = (firstDelayMs = currentPollingInterval) => {
      stopPolling();
      if (pollingPaused) {
        emitSchedule(0, 'paused');
        return;
      }

      const effectivelyInactive = isEffectivelyInactive();
      if (!effectivelyInactive) {
        currentPollingInterval = POLLING_CONFIG.activeIntervalMs;
      } else if (shouldPollWhileHidden()) {
        currentPollingInterval = POLLING_CONFIG.inactiveIntervalMs;
      }

      if (!effectivelyInactive || shouldPollWhileHidden()) {
        scheduleNextPoll(firstDelayMs);
        if (effectivelyInactive) {
          scheduleGraceStop();
        }
      } else {
        emitSchedule(0, 'inactive');
      }
    };

    /** Immediate refresh after the user returns — do not wait for the next poll tick. */
    const handleBecameVisible = () => {
      if (pollingPaused) {
        stopPolling();
        return;
      }

      if (wasTabHidden) {
        wasTabHidden = false;
        if (type === 'all') {
          pollAllAssetTypes(true);
        } else if (!isRateLimitedRef.current(type)) {
          onPollRef.current(type, true);
        } else {
          onPollSkippedRef.current?.();
        }
      }

      if (!isEffectivelyInactive() || shouldPollWhileHidden()) {
        startPolling(POLLING_CONFIG.activeIntervalMs);
      } else {
        stopPolling();
      }
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';

      if (!isVisible) {
        wasTabHidden = true;
        if (hiddenSince == null) {
          hiddenSince = Date.now();
        }
        stopPolling();
        if (shouldPollWhileHidden()) {
          startPolling(POLLING_CONFIG.inactiveIntervalMs);
        }
        return;
      }

      hiddenSince = null;
      clearGraceStopTimeout();
      handleBecameVisible();
    };

    const handleWindowFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      if (pollingPaused || !wasTabHidden) return;
      handleBecameVisible();
    };

    const initialDelayMs =
      !isVisible && shouldPollWhileHidden()
        ? POLLING_CONFIG.inactiveIntervalMs
        : POLLING_CONFIG.activeIntervalMs;
    startPolling(initialDelayMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    const emitUpdate = onScheduleUpdateRef.current;
    return () => {
      cancelled = true;
      stopPolling();
      clearGraceStopTimeout();
      emitUpdate?.(createPollSchedule('inactive', null, 0));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [type, pollingPaused, needsQueuedTorrentPoll]);
}
