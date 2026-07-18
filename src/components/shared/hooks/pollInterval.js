import { POLLING_CONFIG } from './pollingConfig';

/**
 * @param {Object} input
 * @param {boolean} input.pollingPaused — media playing (video/audio)
 * @param {boolean} input.isDisengaged — tab hidden, user idle, or desktop unfocused
 * @param {boolean} input.isWithinEngagementGrace
 */
export function wantsFastPoll({ pollingPaused, isDisengaged, isWithinEngagementGrace }) {
  return !pollingPaused && (!isDisengaged || isWithinEngagementGrace);
}

/**
 * Resolve poll interval and UI mode from presence + auto-start + queue state.
 *
 * Priority: engaged (15s) → auto-start queued (60s) → background (15min).
 * Media playback uses background unless auto-start has queued torrents.
 *
 * @param {Object} input
 * @param {boolean} input.pollingPaused
 * @param {boolean} input.isDisengaged
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
  const fastPoll = wantsFastPoll({ pollingPaused, isDisengaged, isWithinEngagementGrace });

  if (fastPoll) {
    return {
      intervalMs: POLLING_CONFIG.activeIntervalMs,
      mode: 'active',
      shouldPoll: true,
    };
  }

  if (autoStartEnabled && hasQueuedTorrents) {
    return {
      intervalMs: POLLING_CONFIG.autoStartQueuedIntervalMs,
      mode: 'autoStartQueued',
      shouldPoll: true,
    };
  }

  return {
    intervalMs: POLLING_CONFIG.backgroundIntervalMs,
    mode: 'background',
    shouldPoll: true,
  };
}

/**
 * Resolve active vs background interval for auxiliary pollers (health, notifications).
 *
 * @param {Object} input
 * @param {boolean} input.pollingPaused
 * @param {boolean} input.isDisengaged
 * @param {boolean} input.isWithinEngagementGrace
 * @param {number} input.activeIntervalMs
 * @param {number} input.backgroundIntervalMs
 */
export function resolveAuxPollInterval({
  pollingPaused,
  isDisengaged,
  isWithinEngagementGrace,
  activeIntervalMs,
  backgroundIntervalMs,
}) {
  const fastPoll = wantsFastPoll({ pollingPaused, isDisengaged, isWithinEngagementGrace });
  return {
    intervalMs: fastPoll ? activeIntervalMs : backgroundIntervalMs,
    shouldPoll: true,
  };
}

/** Background auto-start only needs torrent list updates (saves usenet/webdl calls on All tab). */
export function shouldPollTorrentsOnly({
  pollingPaused,
  isDisengaged,
  isWithinEngagementGrace,
  autoStartEnabled,
  hasQueuedTorrents,
}) {
  return (
    autoStartEnabled &&
    hasQueuedTorrents &&
    !wantsFastPoll({ pollingPaused, isDisengaged, isWithinEngagementGrace })
  );
}
