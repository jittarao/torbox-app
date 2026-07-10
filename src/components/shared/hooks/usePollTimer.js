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
  workerBackedAutoStart = false,
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
    getUserPresenceRef.current = getUserPresence;
  }, [getUserPresence]);

  useEffect(() => {
    let pollTimeoutId = null;
    let safetyTimeoutId = null;
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

    const getPollState = () => {
      if (workerBackedAutoStart && isDisengaged() && !isWithinEngagementGrace()) {
        return {
          intervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
          mode: 'autoStartWorker',
          shouldPoll: false,
        };
      }

      return resolvePollInterval({
        pollingPaused,
        isDisengaged: isDisengaged(),
        isWithinEngagementGrace: isWithinEngagementGrace(),
        autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
        hasQueuedTorrents: readHasQueuedTorrents(),
      });
    };

    const useTorrentOnlyPoll = () =>
      shouldPollTorrentsOnly({
        isDisengaged: isDisengaged(),
        isWithinEngagementGrace: isWithinEngagementGrace(),
        autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
      });

    const emitSchedule = (delayMs, pollState = getPollState()) => {
      const nextPollAt = delayMs > 0 ? Date.now() + delayMs : null;
      onScheduleUpdateRef.current?.(
        createPollSchedule(pollState.mode, nextPollAt, delayMs > 0 ? delayMs : pollState.intervalMs)
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

    // SharedWorker for accurate background timing (not clamped by Chrome in hidden tabs)
    let workerPort = null;
    let workerFailed = false;
    try {
      const sw = new SharedWorker('/poll-worker.js');
      workerPort = sw.port;
      workerPort.start();
      sw.onerror = () => {
        if (!workerFailed) {
          workerFailed = true;
          workerPort = null;
        }
      };
    } catch {
      workerFailed = true;
      // SharedWorker not supported — fall back to setTimeout
    }

    // Track last tick time for sleep-wake detection
    let lastTickTime = Date.now();
    const resetLastTickTime = () => {
      lastTickTime = Date.now();
    };
    let tickCount = 0;

    const handlePollTick = () => {
      tickCount += 1;
      const tickState = getPollState();
      if (tickState.shouldPoll) {
        const now = Date.now();
        const elapsed = now - lastTickTime;
        const isOverdue = elapsed > tickState.intervalMs * 2;
        lastTickTime = now;
        runPollTick(isOverdue);
      }
      if (tickState.shouldPoll) {
        scheduleNextPoll(tickState.intervalMs);
      } else {
        emitSchedule(0, tickState);
      }
    };

    if (workerPort) {
      workerPort.onmessage = (event) => {
        if (event.data?.type === 'tick' && !cancelled) {
          handlePollTick();
        }
      };
    }

    const clearSafetyTimeout = () => {
      if (safetyTimeoutId) {
        clearTimeout(safetyTimeoutId);
        safetyTimeoutId = null;
      }
    };

    const scheduleNextPoll = (delayMs) => {
      if (cancelled) return;
      const pollState = getPollState();
      if (!pollState.shouldPoll) {
        emitSchedule(0, pollState);
        return;
      }

      emitSchedule(delayMs, pollState);

      if (workerPort) {
        workerPort.postMessage({ type: 'poll:start', intervalMs: delayMs });
        // Safety net: fall back to setTimeout if SharedWorker silently fails
        // Uses its own timer (safetyTimeoutId) so resetPollTimer→stopPolling doesn't clear it
        clearSafetyTimeout();
        safetyTimeoutId = setTimeout(() => {
          safetyTimeoutId = null;
          if (cancelled) return;
          workerPort = null;
          workerFailed = true;
          clearTimeout(pollTimeoutId);
          handlePollTick();
        }, delayMs * 2);
      } else {
        pollTimeoutId = setTimeout(handlePollTick, delayMs);
      }
    };

    const stopPolling = () => {
      clearSafetyTimeout();
      if (workerPort) {
        workerPort.postMessage({ type: 'poll:stop' });
      }
      if (pollTimeoutId) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
      clearGraceStopTimeout();
      emitSchedule(0, getPollState());
    };

    const startPolling = (firstDelayMs) => {
      stopPolling();
      resetLastTickTime();
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
        resetLastTickTime();
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
      const pollState = getPollState();
      if (pollState.shouldPoll) {
        startPolling(pollState.intervalMs);
      } else {
        stopPolling();
        emitSchedule(0, pollState);
      }
    });

    return () => {
      cancelled = true;
      unregisterPollTimerReset();
      stopPolling();
      clearSafetyTimeout();
      clearGraceStopTimeout();
      if (workerPort) {
        try {
          workerPort.close();
        } catch {}
      }
      onReEngagedRef.current = () => {};
      onDisengagedRef.current = () => {};
      onScheduleUpdateRef.current?.(createPollSchedule('inactive', null, 0));
    };
  }, [
    type,
    pollingPaused,
    autoStartApplies,
    hasQueuedTorrents,
    workerBackedAutoStart,
    onReEngagedRef,
    onDisengagedRef,
  ]);
}
