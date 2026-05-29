import { useEffect, useRef } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';
import { POLLING_CONFIG } from './pollingConfig';
import { createPollSchedule } from './pollSchedule';

const ALL_ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

const USER_ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'];

/**
 * Visibility- and idle-aware polling for download lists.
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
  const needsQueuedTorrentPoll = useTorboxDownloadsStore((s) => {
    if (type !== 'torrents' && type !== 'all') return false;
    const options = getAutoStartOptions();
    if (!options?.autoStart) return false;
    return selectHasQueuedTorrents(s);
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
    let idleTimeoutId = null;
    let wasDisengaged = false;
    let awaySince = null;
    let userIdle = false;
    let isVisible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    let currentPollingInterval = POLLING_CONFIG.activeIntervalMs;
    let cancelled = false;

    if (!isVisible) {
      awaySince = Date.now();
      wasDisengaged = true;
    }

    const clearGraceStopTimeout = () => {
      if (graceStopTimeoutId) {
        clearTimeout(graceStopTimeoutId);
        graceStopTimeoutId = null;
      }
    };

    const clearIdleTimeout = () => {
      if (idleTimeoutId) {
        clearTimeout(idleTimeoutId);
        idleTimeoutId = null;
      }
    };

    const isDisengaged = () => !isVisible || userIdle;

    const isWithinEngagementGrace = () => {
      if (!isDisengaged() || awaySince == null) return false;
      return Date.now() - awaySince < POLLING_CONFIG.engagementGracePeriodMs;
    };

    const shouldPollForAutoStartQueued = () => {
      if (type !== 'torrents' && type !== 'all') return false;
      const options = getAutoStartOptions();
      if (!options?.autoStart) return false;
      return selectHasQueuedTorrents(useTorboxDownloadsStore.getState());
    };

    const shouldPollWhileDisengaged = () => {
      if (pollingPaused) return false;
      return isWithinEngagementGrace() || shouldPollForAutoStartQueued();
    };

    const getPollIntervalMs = () => {
      if (!isDisengaged()) return POLLING_CONFIG.activeIntervalMs;
      if (isWithinEngagementGrace()) return POLLING_CONFIG.activeIntervalMs;
      if (shouldPollForAutoStartQueued()) return POLLING_CONFIG.inactiveIntervalMs;
      return currentPollingInterval;
    };

    const getScheduleMode = () => {
      if (pollingPaused) return 'paused';
      if (!isDisengaged()) return 'active';
      if (isWithinEngagementGrace()) return 'active';
      if (shouldPollForAutoStartQueued()) return 'slow';
      return 'inactive';
    };

    const emitSchedule = (delayMs, mode = getScheduleMode()) => {
      const nextPollAt = delayMs > 0 ? Date.now() + delayMs : null;
      onScheduleUpdateRef.current?.(
        createPollSchedule(mode, nextPollAt, delayMs > 0 ? delayMs : currentPollingInterval)
      );
    };

    const pollAllAssetTypes = (bypassCache) => {
      let anySkipped = false;
      let completed = 0;

      const finishIfDone = () => {
        completed += 1;
        if (completed === ALL_ASSET_TYPES.length && anySkipped) {
          onPollSkippedRef.current?.();
        }
      };

      ALL_ASSET_TYPES.forEach((assetType, index) => {
        const runPoll = () => {
          if (cancelled) return;
          if (isRateLimitedRef.current(assetType)) {
            anySkipped = true;
          } else {
            onPollRef.current(assetType, bypassCache);
          }
          finishIfDone();
        };

        if (index === 0) {
          runPoll();
        } else {
          setTimeout(runPoll, index * POLLING_CONFIG.allTabStaggerMs);
        }
      });
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
        const disengaged = isDisengaged();
        if (!disengaged || shouldPollWhileDisengaged()) {
          runPollTick(false);
        }
        currentPollingInterval = getPollIntervalMs();
        if (!disengaged || shouldPollWhileDisengaged()) {
          scheduleNextPoll(currentPollingInterval);
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
      if (!isDisengaged() || awaySince == null || !isWithinEngagementGrace()) return;

      const remainingMs = awaySince + POLLING_CONFIG.engagementGracePeriodMs - Date.now();
      if (remainingMs <= 0) return;

      graceStopTimeoutId = setTimeout(() => {
        graceStopTimeoutId = null;
        if (cancelled || !isDisengaged()) return;
        if (shouldPollWhileDisengaged()) {
          stopPolling();
          startPolling(getPollIntervalMs());
          return;
        }
        stopPolling();
      }, remainingMs);
    };

    const startPolling = (firstDelayMs = currentPollingInterval) => {
      stopPolling();
      if (pollingPaused) {
        emitSchedule(0, 'paused');
        return;
      }

      currentPollingInterval = getPollIntervalMs();
      const disengaged = isDisengaged();

      if (!disengaged || shouldPollWhileDisengaged()) {
        scheduleNextPoll(firstDelayMs);
        if (disengaged) {
          scheduleGraceStop();
        }
      } else {
        emitSchedule(0, 'inactive');
      }
    };

    const runImmediateRefresh = () => {
      if (type === 'all') {
        pollAllAssetTypes(true);
      } else if (!isRateLimitedRef.current(type)) {
        onPollRef.current(type, true);
      } else {
        onPollSkippedRef.current?.();
      }
    };

    /** Immediate refresh after re-engagement — do not wait for the next poll tick. */
    const handleReEngaged = () => {
      if (pollingPaused) {
        stopPolling();
        return;
      }

      if (wasDisengaged) {
        wasDisengaged = false;
        runImmediateRefresh();
      }

      awaySince = null;
      clearGraceStopTimeout();
      userIdle = false;
      startPolling(POLLING_CONFIG.activeIntervalMs);
    };

    const resetIdleTimer = () => {
      clearIdleTimeout();
      if (!isVisible || pollingPaused) return;
      idleTimeoutId = setTimeout(() => {
        idleTimeoutId = null;
        if (cancelled || !isVisible || pollingPaused) return;
        userIdle = true;
        if (awaySince == null) {
          awaySince = Date.now();
        }
        wasDisengaged = true;
        stopPolling();
        if (shouldPollWhileDisengaged()) {
          startPolling(POLLING_CONFIG.activeIntervalMs);
        } else {
          emitSchedule(0, 'inactive');
        }
      }, POLLING_CONFIG.userIdleThresholdMs);
    };

    const markUserActive = () => {
      if (!isVisible || pollingPaused) return;
      const wasIdle = userIdle;
      userIdle = false;
      resetIdleTimer();
      if (wasIdle) {
        handleReEngaged();
      }
    };

    const handleDisengaged = () => {
      if (awaySince == null) {
        awaySince = Date.now();
      }
      wasDisengaged = true;
      clearIdleTimeout();
      stopPolling();
      if (shouldPollWhileDisengaged()) {
        startPolling(POLLING_CONFIG.activeIntervalMs);
      } else {
        emitSchedule(0, 'inactive');
      }
    };

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';

      if (!isVisible) {
        handleDisengaged();
        return;
      }

      userIdle = false;
      handleReEngaged();
      resetIdleTimer();
    };

    const handleWindowFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      if (pollingPaused) return;
      if (wasDisengaged) {
        handleReEngaged();
      }
      markUserActive();
    };

    const onUserActivity = () => {
      markUserActive();
    };

    const initialDelayMs =
      isDisengaged() && shouldPollWhileDisengaged()
        ? getPollIntervalMs()
        : POLLING_CONFIG.activeIntervalMs;
    startPolling(initialDelayMs);

    if (isVisible) {
      markUserActive();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    USER_ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, onUserActivity, { passive: true });
    });

    const emitUpdate = onScheduleUpdateRef.current;
    return () => {
      cancelled = true;
      stopPolling();
      clearGraceStopTimeout();
      clearIdleTimeout();
      emitUpdate?.(createPollSchedule('inactive', null, 0));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      USER_ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, onUserActivity);
      });
    };
  }, [type, pollingPaused, needsQueuedTorrentPoll]);
}
