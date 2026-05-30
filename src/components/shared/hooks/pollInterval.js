import { POLLING_CONFIG } from './pollingConfig';

/**
 * Resolve poll interval and UI mode from presence + auto-start + queue state.
 *
 * Active tab (visible, not idle) or engagement grace → 15s always.
 * Hidden/idle with auto-start: 30s when filling queue, 15min when watching for new queue items.
 *
 * @param {Object} input
 * @param {boolean} input.pollingPaused
 * @param {boolean} input.isDisengaged — tab hidden or user idle
 * @param {boolean} input.isWithinEngagementGrace
 * @param {boolean} input.autoStartEnabled — user setting + torrents/all tab (caller)
 * @param {boolean} input.hasQueuedTorrents — from store after last fetch
 * @returns {{ intervalMs: number, mode: import('./pollSchedule').PollScheduleMode, shouldPoll: boolean }}
 */
export function resolvePollInterval({
  pollingPaused,
  isDisengaged,
  isWithinEngagementGrace,
  autoStartEnabled,
  hasQueuedTorrents,
}) {
  if (pollingPaused) {
    return { intervalMs: 0, mode: 'paused', shouldPoll: false };
  }

  if (!isDisengaged || isWithinEngagementGrace) {
    return {
      intervalMs: POLLING_CONFIG.activeIntervalMs,
      mode: 'active',
      shouldPoll: true,
    };
  }

  if (!autoStartEnabled) {
    return { intervalMs: 0, mode: 'inactive', shouldPoll: false };
  }

  if (hasQueuedTorrents) {
    return {
      intervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
      mode: 'autoStartQueued',
      shouldPoll: true,
    };
  }

  return {
    intervalMs: POLLING_CONFIG.autoStartWatchIntervalMs,
    mode: 'autoStartWatch',
    shouldPoll: true,
  };
}

/** Background auto-start only needs torrent list updates (saves usenet/webdl calls on All tab). */
export function shouldPollTorrentsOnly({ isDisengaged, isWithinEngagementGrace, autoStartEnabled }) {
  return autoStartEnabled && isDisengaged && !isWithinEngagementGrace;
}
