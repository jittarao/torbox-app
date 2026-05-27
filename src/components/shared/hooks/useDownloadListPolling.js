import { useEffect, useRef } from 'react';
import { isQueuedItem, getAutoStartOptions } from '@/utils/utility';
import { POLLING_CONFIG } from './pollingConfig';

const ALL_ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

/**
 * Visibility-aware polling for download lists.
 *
 * @param {Object} options
 * @param {string} options.type - Active view type: torrents | usenet | webdl | all
 * @param {boolean} options.pollingPaused - True when any pause reason is active
 * @param {import('react').RefObject<Array>} options.torrentsRef - Latest torrents for auto-start checks
 * @param {(assetType: string, bypassCache?: boolean) => void | Promise<void>} options.onPoll - Per-type fetch
 * @param {(assetType?: string) => boolean} options.isRateLimited
 * @param {() => void} [options.onPollSkipped] - Called when a tick is skipped due to rate limiting
 */
export function useDownloadListPolling({
  type,
  pollingPaused,
  torrentsRef,
  onPoll,
  isRateLimited,
  onPollSkipped,
}) {
  const onPollRef = useRef(onPoll);
  const isRateLimitedRef = useRef(isRateLimited);
  const onPollSkippedRef = useRef(onPollSkipped);

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
    let pollTimeoutId = null;
    let wasTabHidden = false;
    let isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    let currentPollingInterval = POLLING_CONFIG.activeIntervalMs;
    let cancelled = false;

    const shouldPollWhileHidden = () => {
      if (pollingPaused) return false;
      if (type !== 'torrents' && type !== 'all') return false;
      const options = getAutoStartOptions();
      return Boolean(options?.autoStart && torrentsRef.current?.some(isQueuedItem));
    };

    const isEffectivelyInactive = () => pollingPaused || !isVisible;

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
        }
      }, delayMs);
    };

    const stopPolling = () => {
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
    };

    const startPolling = (firstDelayMs = currentPollingInterval) => {
      stopPolling();
      if (pollingPaused) return;

      const effectivelyInactive = isEffectivelyInactive();
      if (!effectivelyInactive) {
        currentPollingInterval = POLLING_CONFIG.activeIntervalMs;
      } else if (shouldPollWhileHidden()) {
        currentPollingInterval = POLLING_CONFIG.inactiveIntervalMs;
      }

      if (!effectivelyInactive || shouldPollWhileHidden()) {
        scheduleNextPoll(firstDelayMs);
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
        stopPolling();
        if (shouldPollWhileHidden()) {
          startPolling(POLLING_CONFIG.inactiveIntervalMs);
        }
        return;
      }

      handleBecameVisible();
    };

    const handleWindowFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      if (pollingPaused || !wasTabHidden) return;
      handleBecameVisible();
    };

    startPolling(POLLING_CONFIG.activeIntervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [type, pollingPaused, torrentsRef]);
}
