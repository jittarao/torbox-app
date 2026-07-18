/**
 * Pure helpers for presence-driven polling transitions (unit-tested).
 */

/**
 * @param {Object} input
 * @param {boolean} input.wasPaused
 * @param {boolean} input.pollingPaused
 * @param {boolean} input.isEffectivelyPresent
 * @param {boolean} input.isUserIdle
 */
export function shouldReEngageOnMediaUnpause({
  wasPaused,
  pollingPaused,
  isEffectivelyPresent,
  isUserIdle,
}) {
  if (!wasPaused || pollingPaused) return false;
  if (!isEffectivelyPresent || isUserIdle) return false;
  return true;
}

/**
 * @param {boolean | undefined} prevHasQueue
 * @param {boolean | undefined} nextHasQueue
 */
export function shouldRescheduleOnQueueChange(prevHasQueue, nextHasQueue) {
  return prevHasQueue !== nextHasQueue;
}
