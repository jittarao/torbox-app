import { useEffect, useRef, useState } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';
import { POLLING_CONFIG } from './pollingConfig';
import { createPollSchedule } from './pollSchedule';

const ALL_ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

/**
 * Core poll-timer logic. Composed inside useDownloadListPolling.
 *
 * Manages the polling interval schedule, auto-start queued-check, and per-type rate limiting.
 * Receives engagement/disengagement signals via onReEngagedRef/onDisengagedRef from useUserPresence.
 */
export function usePollTimer({
  type,
  pollingPaused,
  onPoll,
  isRateLimited,
  onPollSkipped,
  onScheduleUpdate,
  getUserPresence,
  onReEngagedRef,
  onDisengagedRef,
}) {
  const [autoStartEnabled, setAutoStartEnabled] = useState(
    () => getAutoStartOptions()?.autoStart ?? false
  );

  useEffect(() => {
    const syncAutoStart = () => setAutoStartEnabled(getAutoStartOptions()?.autoStart ?? false);
    syncAutoStart();
    window.addEventListener('storage', syncAutoStart);
    return () => window.removeEventListener('storage', syncAutoStart);
  }, []);

  const hasQueuedTorrents = useTorboxDownloadsStore((s) => selectHasQueuedTorrents(s));
  const needsQueuedTorrentPoll =
    autoStartEnabled &&
    (type === 'torrents' || type === 'all') &&
    hasQueuedTorrents;

  const onPollRef = useRef(onPoll);
  const isRateLimitedRef = useRef(isRateLimited);
  const onPollSkippedRef = useRef(onPollSkipped);
  const onScheduleUpdateRef = useRef(onScheduleUpdate);
  const getUserPresenceRef = useRef(getUserPresence);

  useEffect(() => { onPollRef.current = onPoll; }, [onPoll]);
  useEffect(() => { isRateLimitedRef.current = isRateLimited; }, [isRateLimited]);
  useEffect(() => { onPollSkippedRef.current = onPollSkipped; }, [onPollSkipped]);
  useEffect(() => { onScheduleUpdateRef.current = onScheduleUpdate; }, [onScheduleUpdate]);
  useEffect(() => { getUserPresenceRef.current = getUserPresence; }, [getUserPresence]);

  useEffect(() => {
    let pollTimeoutId = null;
    let graceStopTimeoutId = null;
    let cancelled = false;
    let currentPollingInterval = POLLING_CONFIG.activeIntervalMs;

    const presence = () => getUserPresenceRef.current();

    const clearGraceStopTimeout = () => {
      if (graceStopTimeoutId) {
        clearTimeout(graceStopTimeoutId);
        graceStopTimeoutId = null;
      }
    };

    const isDisengaged = () => presence().isDisengaged();
    const awaySince = () => presence().awaySince();

    const isWithinEngagementGrace = () => {
      const since = awaySince();
      if (!isDisengaged() || since == null) return false;
      return Date.now() - since < POLLING_CONFIG.engagementGracePeriodMs;
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

    const runImmediateRefresh = () => {
      if (type === 'all') {
        pollAllAssetTypes(true);
        return;
      }
      if (isRateLimitedRef.current(type)) {
        onPollSkippedRef.current?.();
        return;
      }
      onPollRef.current(type, true);
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

    const scheduleGraceStop = () => {
      clearGraceStopTimeout();
      const since = awaySince();
      if (!isDisengaged() || since == null || !isWithinEngagementGrace()) return;

      const remainingMs = since + POLLING_CONFIG.engagementGracePeriodMs - Date.now();
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

    const handleReEngaged = (immediateRefresh = false) => {
      if (pollingPaused) {
        stopPolling();
        return;
      }
      if (immediateRefresh) {
        runImmediateRefresh();
      }
      clearGraceStopTimeout();
      startPolling(POLLING_CONFIG.activeIntervalMs);
    };

    const handleDisengaged = () => {
      stopPolling();
      if (shouldPollWhileDisengaged()) {
        startPolling(POLLING_CONFIG.activeIntervalMs);
      } else {
        emitSchedule(0, 'inactive');
      }
    };

    onReEngagedRef.current = handleReEngaged;
    onDisengagedRef.current = handleDisengaged;

    const initialDelayMs =
      isDisengaged() && shouldPollWhileDisengaged()
        ? getPollIntervalMs()
        : POLLING_CONFIG.activeIntervalMs;
    startPolling(initialDelayMs);

    return () => {
      cancelled = true;
      stopPolling();
      clearGraceStopTimeout();
      onReEngagedRef.current = () => {};
      onDisengagedRef.current = () => {};
      onScheduleUpdateRef.current?.(createPollSchedule('inactive', null, 0));
    };
  }, [type, pollingPaused, needsQueuedTorrentPoll, onReEngagedRef, onDisengagedRef]);
}
