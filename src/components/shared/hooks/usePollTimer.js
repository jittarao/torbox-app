import { useEffect, useRef, useState } from 'react';
import { getAutoStartOptions } from '@/utils/utility';
import { useTorboxDownloadsStore, selectHasQueuedTorrents } from '@/store/torboxDownloadsStore';
import { registerPollTimerReset, unregisterPollTimerReset } from '@/store/pollTimerReset';
import { POLLING_CONFIG } from './pollingConfig';
import { createPollSchedule } from './pollSchedule';
import { resolvePollInterval, shouldPollTorrentsOnly } from './pollInterval';
import { pollScheduleFirstDelay } from './pollTimerSchedule';
import { shouldRescheduleOnQueueChange } from './userPresenceTransitions';

const ALL_ASSET_TYPES = ['torrents', 'usenet', 'webdl'];

/**
 * @param {Object} options
 * @param {string} options.type
 * @param {boolean} options.autoStartApplies
 * @param {import('react').RefObject<boolean>} options.pollingPausedRef
 * @param {import('react').RefObject<Function>} options.onPollRef
 * @param {import('react').RefObject<Function>} options.isRateLimitedRef
 * @param {import('react').RefObject<Function | undefined>} options.onPollSkippedRef
 * @param {import('react').RefObject<Function | undefined>} options.onScheduleUpdateRef
 * @param {import('react').RefObject<Function>} options.getUserPresenceRef
 * @param {import('react').RefObject<Function>} options.onReEngagedRef
 * @param {import('react').RefObject<Function>} options.onDisengagedRef
 */
function subscribePollTimer({
  type,
  autoStartApplies,
  pollingPausedRef,
  onPollRef,
  isRateLimitedRef,
  onPollSkippedRef,
  onScheduleUpdateRef,
  getUserPresenceRef,
  onReEngagedRef,
  onDisengagedRef,
}) {
  let pollTimeoutId = null;
  let safetyTimeoutId = null;
  let graceStopTimeoutId = null;
  let staggerTimeoutIds = [];
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
      pollingPaused: pollingPausedRef.current,
      isDisengaged: isDisengaged(),
      isWithinEngagementGrace: isWithinEngagementGrace(),
      autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
      hasQueuedTorrents: readHasQueuedTorrents(),
    });

  const useTorrentOnlyPoll = () =>
    shouldPollTorrentsOnly({
      pollingPaused: pollingPausedRef.current,
      isDisengaged: isDisengaged(),
      isWithinEngagementGrace: isWithinEngagementGrace(),
      autoStartEnabled: autoStartApplies && getAutoStartOptions()?.autoStart === true,
      hasQueuedTorrents: readHasQueuedTorrents(),
    });

  const emitSchedule = (delayMs, pollState = getPollState()) => {
    const nextPollAt = delayMs > 0 ? Date.now() + delayMs : null;
    onScheduleUpdateRef.current?.(
      createPollSchedule(pollState.mode, nextPollAt, delayMs > 0 ? delayMs : pollState.intervalMs)
    );
  };

  const pollAllAssetTypes = () => {
    let anySkipped = false;
    let completed = 0;
    const nextStaggerTimeoutIds = [];

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
          onPollRef.current(assetType);
        }
        finishIfDone();
      };

      if (index === 0) {
        runPoll();
      } else {
        const staggerId = setTimeout(runPoll, index * POLLING_CONFIG.allTabStaggerMs);
        nextStaggerTimeoutIds.push(staggerId);
      }
    });

    return nextStaggerTimeoutIds;
  };

  const runImmediateRefresh = () => {
    if (type === 'all') {
      clearStaggerTimeouts();
      staggerTimeoutIds = pollAllAssetTypes();
      return;
    }
    if (isRateLimitedRef.current(type)) {
      onPollSkippedRef.current?.();
      return;
    }
    onPollRef.current(type);
  };

  const runPollTick = () => {
    if (type === 'all' && useTorrentOnlyPoll()) {
      if (isRateLimitedRef.current('torrents')) {
        onPollSkippedRef.current?.();
        return;
      }
      onPollRef.current('torrents');
      return;
    }

    if (type === 'all') {
      clearStaggerTimeouts();
      staggerTimeoutIds = pollAllAssetTypes();
      return;
    }

    if (isRateLimitedRef.current(type)) {
      onPollSkippedRef.current?.();
      return;
    }
    onPollRef.current(type);
  };

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
  }

  const resetLastTickTime = () => {};

  const clearStaggerTimeouts = () => {
    staggerTimeoutIds.forEach(clearTimeout);
    staggerTimeoutIds = [];
  };

  const clearSafetyTimeout = () => {
    if (safetyTimeoutId) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
    }
  };

  const handlePollTick = () => {
    clearSafetyTimeout();
    const tickState = getPollState();
    if (tickState.shouldPoll) {
      resetLastTickTime();
      runPollTick();
    }
    if (tickState.shouldPoll) {
      scheduleNextPoll(tickState.intervalMs);
    } else {
      emitSchedule(0, tickState);
    }
  };

  const handleWorkerMessage = (event) => {
    if (event.data?.type === 'tick' && !cancelled) {
      handlePollTick();
    }
  };

  if (workerPort) {
    workerPort.addEventListener('message', handleWorkerMessage);
  }

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
    clearStaggerTimeouts();
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
    if (immediateRefresh) {
      runImmediateRefresh();
      resetLastTickTime();
    }
    clearGraceStopTimeout();
    startPolling(pollScheduleFirstDelay(getPollState()));
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

  startPolling(pollScheduleFirstDelay(getPollState()));

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

  const unsubscribeQueue = useTorboxDownloadsStore.subscribe((state, prevState) => {
    if (cancelled) return;
    const prevHasQueue = selectHasQueuedTorrents(prevState);
    const nextHasQueue = selectHasQueuedTorrents(state);
    if (!shouldRescheduleOnQueueChange(prevHasQueue, nextHasQueue)) return;

    const pollState = getPollState();
    if (pollState.shouldPoll) {
      startPolling(pollScheduleFirstDelay(pollState));
    }
  });

  return () => {
    cancelled = true;
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
    if (safetyTimeoutId) {
      clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
    }
    if (graceStopTimeoutId) {
      clearTimeout(graceStopTimeoutId);
      graceStopTimeoutId = null;
    }
    staggerTimeoutIds.forEach(clearTimeout);
    staggerTimeoutIds = [];
    unsubscribeQueue();
    unregisterPollTimerReset();
    stopPolling();
    if (workerPort) {
      workerPort.removeEventListener('message', handleWorkerMessage);
      try {
        workerPort.close();
      } catch {}
    }
    onReEngagedRef.current = () => {};
    onDisengagedRef.current = () => {};
    onScheduleUpdateRef.current?.(createPollSchedule('inactive', null, 0));
  };
}

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
  const pollingPausedRef = useRef(pollingPaused);

  useEffect(() => {
    pollingPausedRef.current = pollingPaused;
  }, [pollingPaused]);
  const prevPollingPausedRef = useRef(pollingPaused);

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

  useEffect(
    () =>
      subscribePollTimer({
        type,
        autoStartApplies,
        pollingPausedRef,
        onPollRef,
        isRateLimitedRef,
        onPollSkippedRef,
        onScheduleUpdateRef,
        getUserPresenceRef,
        onReEngagedRef,
        onDisengagedRef,
      }),
    [type, autoStartApplies, onReEngagedRef, onDisengagedRef]
  );

  useEffect(() => {
    const wasPaused = prevPollingPausedRef.current;
    prevPollingPausedRef.current = pollingPaused;
    if (!wasPaused && pollingPaused) {
      onReEngagedRef.current?.(false);
    }
  }, [pollingPaused, onReEngagedRef]);
}
