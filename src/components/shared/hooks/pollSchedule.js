/** @typedef {'active' | 'autoStartQueued' | 'autoStartWatch' | 'autoStartWorker' | 'paused' | 'inactive'} PollScheduleMode */

/**
 * @typedef {Object} PollSchedule
 * @property {number | null} nextPollAt - Epoch ms for the next scheduled poll, or null when idle
 * @property {number} intervalMs - Length of the current countdown window
 * @property {PollScheduleMode} mode
 */

/**
 * @param {PollScheduleMode} mode
 * @param {number | null} nextPollAt
 * @param {number} intervalMs
 * @returns {PollSchedule}
 */
export function createPollSchedule(mode, nextPollAt, intervalMs) {
  return { mode, nextPollAt, intervalMs };
}
