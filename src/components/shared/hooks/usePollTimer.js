import { useEffect, useRef, useState } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';
import { registerPollTimerReset, unregisterPollTimerReset } from '@/store/pollTimerReset';
import { POLLING_CONFIG } from './pollingConfig';
import { createPollSchedule } from './pollSchedule';
import { resolvePollInterval, shouldPollTorrentsOnly } from './pollInterval';

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
    window.addEventListener('torrent-upload-options', syncAutoStart);
    return () => {
      window.removeEventListener('storage', syncAutoStart);
      window.removeEventListener('torrent-upload-options', syncAutoStart);
    };
  }, []);

  const autoStartApplies = autoStartEnabled && (type === 'torrents' || type === 'all');
  const hasQueuedTorrents = useTorboxDownloadsStore((s) => selectHasQueuedTorrents(s));

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

    const readHasQueuedTorrents = () => {
      if (type !== 'torrents' && type !== 'all') return false;
      return selectHasQueuedTorrents(useTorboxDownloadsStore.getState());
    };

    const getPollState = () =>
      resolvePollInterval({
        pollingPaused,
        isDisengaged: isDisengaged(),
        isWithinEngagementGrace: isWithinEngagementGrace(),
        autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
        hasQueuedTorrents: readHasQueuedTorrents(),
      });

    const useTorrentOnlyPoll = () =>
      shouldPollTorrentsOnly({
        isDisengaged: isDisengaged(),
        isWithinEngagementGrace: isWithinEngagementGrace(),
        autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
      });

    const emitSchedule = (delayMs, pollState = getPollState()) => {
      const nextPollAt = delayMs > 0 ? Date.now() + delayMs : null;
      onScheduleUpdateRef.current?.(
        createPollSchedule(
          pollState.mode,
          nextPollAt,
          delayMs > 0 ? delayMs : pollState.intervalMs
        )
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
      if (type === 'all' && useTorrentOnlyPoll()) {
        if (isRateLimitedRef.current('torrents')) {
          onPollSkippedRef.current?.();
          return;
        }
        onPollRef.current('torrents', bypassCache);
        return;
      }

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
      const pollState = getPollState();
      if (!pollState.shouldPoll) {
        emitSchedule(0, pollState);
        return;
      }

      emitSchedule(delayMs, pollState);
      pollTimeoutId = setTimeout(() => {
        if (cancelled) return;

        const tickState = getPollState();
        if (tickState.shouldPoll) {
          runPollTick(false);
        }

        if (tickState.shouldPoll) {
          scheduleNextPoll(tickState.intervalMs);
        } else {
          emitSchedule(0, tickState);
        }
      }, delayMs);
    };

    const stopPolling = () => {
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
      clearGraceStopTimeout();
      emitSchedule(0, getPollState());
    };

    const startPolling = (firstDelayMs) => {
      stopPolling();
      const pollState = getPollState();
      if (!pollState.shouldPoll) {
        emitSchedule(0, pollState);
        return;
      }

      const delay = firstDelayMs ?? pollState.intervalMs;
      scheduleNextPoll(delay);

      if (isDisengaged()) {
        scheduleGraceStop();
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
        const pollState = getPollState();
        if (pollState.shouldPoll) {
          stopPolling();
          startPolling(pollState.intervalMs);
        } else {
          stopPolling();
        }
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
      const pollState = getPollState();
      if (pollState.shouldPoll) {
        startPolling(pollState.intervalMs);
      } else {
        emitSchedule(0, pollState);
      }
    };

    onReEngagedRef.current = handleReEngaged;
    onDisengagedRef.current = handleDisengaged;

    const initialState = getPollState();
    const initialDelay =
      initialState.shouldPoll && isDisengaged() && !isWithinEngagementGrace()
        ? initialState.intervalMs
        : POLLING_CONFIG.activeIntervalMs;
    startPolling(initialDelay);

    registerPollTimerReset(() => {
      if (cancelled) return;
      startPolling(POLLING_CONFIG.activeIntervalMs);
    });

    return () => {
      cancelled = true;
      unregisterPollTimerReset();
      stopPolling();
      clearGraceStopTimeout();
      onReEngagedRef.current = () => {};
      onDisengagedRef.current = () => {};
      onScheduleUpdateRef.current?.(createPollSchedule('inactive', null, 0));
    };
  }, [
    type,
    pollingPaused,
    autoStartApplies,
    hasQueuedTorrents,
    onReEngagedRef,
    onDisengagedRef,
  ]);
}
