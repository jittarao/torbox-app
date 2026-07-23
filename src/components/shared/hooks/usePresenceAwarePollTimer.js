'use client';

import { useEffect, useRef } from 'react';
import { useLatestRef } from '@/hooks/useLatestRef';
import { usePollingPauseStore, selectIsPaused } from '@/store/pollingPauseStore';
import { useUserPresenceStore } from '@/store/userPresenceStore';
import { POLLING_CONFIG } from './pollingConfig';
import { resolveAuxPollInterval } from './pollInterval';

/**
 * @param {Object} options
 * @param {number} options.activeIntervalMs
 * @param {number} options.backgroundIntervalMs
 * @param {import('react').RefObject<() => void>} options.onTickRef
 */
function subscribePresenceAwarePollTimer({ activeIntervalMs, backgroundIntervalMs, onTickRef }) {
  let pollTimeoutId = null;
  let cancelled = false;
  let currentIntervalMs = null;

  const isWithinEngagementGrace = () => {
    const { awaySince, isVisible, isUserIdle, desktopDisengaged } = useUserPresenceStore.getState();
    const isDisengaged = !isVisible || isUserIdle || desktopDisengaged;
    if (!isDisengaged || awaySince == null) return false;
    return Date.now() - awaySince < POLLING_CONFIG.engagementGracePeriodMs;
  };

  const getPollState = () => {
    const presence = useUserPresenceStore.getState();
    const isDisengaged = !presence.isVisible || presence.isUserIdle || presence.desktopDisengaged;
    const pollingPaused = selectIsPaused(usePollingPauseStore.getState());
    return resolveAuxPollInterval({
      pollingPaused,
      isDisengaged,
      isWithinEngagementGrace: isWithinEngagementGrace(),
      activeIntervalMs,
      backgroundIntervalMs,
    });
  };

  const clearPollTimeout = () => {
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      pollTimeoutId = null;
    }
  };

  const scheduleNext = (delayMs) => {
    clearPollTimeout();
    if (cancelled) return;
    currentIntervalMs = delayMs;
    pollTimeoutId = setTimeout(handleTick, delayMs);
  };

  const handleTick = () => {
    if (cancelled) return;
    onTickRef.current();
    scheduleNext(getPollState().intervalMs);
  };

  const reschedule = (firstDelayMs) => {
    scheduleNext(firstDelayMs ?? getPollState().intervalMs);
  };

  const handleReEngaged = (immediateRefresh) => {
    if (immediateRefresh) {
      onTickRef.current();
    }
    reschedule(immediateRefresh ? activeIntervalMs : undefined);
  };

  const handleDisengaged = () => {
    reschedule();
  };

  const handlePresenceOrPauseChange = () => {
    const state = getPollState();
    if (state.intervalMs !== currentIntervalMs) {
      reschedule(state.intervalMs);
    }
  };

  onTickRef.current();
  reschedule(getPollState().intervalMs);

  const unsubRe = useUserPresenceStore.getState().subscribeReEngaged(handleReEngaged);
  const unsubDis = useUserPresenceStore.getState().subscribeDisengaged(handleDisengaged);
  const unsubPresence = useUserPresenceStore.subscribe(handlePresenceOrPauseChange);
  const unsubPause = usePollingPauseStore.subscribe(handlePresenceOrPauseChange);

  return () => {
    cancelled = true;
    clearPollTimeout();
    unsubRe();
    unsubDis();
    unsubPresence();
    unsubPause();
  };
}

/**
 * Presence-aware poll scheduler for auxiliary pollers (health, notifications).
 * Active interval while engaged; background interval when tab hidden, idle, desktop
 * unfocused, or media playing. Immediate tick on re-engage.
 *
 * @param {Object} options
 * @param {number} options.activeIntervalMs
 * @param {number} [options.backgroundIntervalMs]
 * @param {() => void} options.onTick
 * @param {boolean} [options.enabled]
 */
export function usePresenceAwarePollTimer({
  activeIntervalMs,
  backgroundIntervalMs = POLLING_CONFIG.backgroundIntervalMs,
  onTick,
  enabled = true,
}) {
  const onTickRef = useLatestRef(onTick);

  useEffect(() => {
    if (!enabled) return;

    return subscribePresenceAwarePollTimer({
      activeIntervalMs,
      backgroundIntervalMs,
      onTickRef,
    });
  }, [enabled, activeIntervalMs, backgroundIntervalMs, onTickRef]);
}
