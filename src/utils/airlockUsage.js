export const AIRLOCK_DOT_COUNT = 25;

/**
 * @param {number} usedBytes
 * @param {number} limitBytes
 * @returns {number} Percent 0–100+ (100+ when over limit)
 */
export function getAirlockPercent(usedBytes, limitBytes) {
  const used = usedBytes || 0;
  const limit = limitBytes || 0;
  if (limit <= 0) return used > 0 ? 100 : 0;
  return (used / limit) * 100;
}

/**
 * @param {number} percent
 * @param {number} [totalDots]
 * @returns {number}
 */
export function getAirlockFilledDots(percent, totalDots = AIRLOCK_DOT_COUNT) {
  if (percent <= 0) return 0;
  if (percent >= 100) return totalDots;
  return Math.ceil((percent / 100) * totalDots);
}

/**
 * @param {number} usedBytes
 * @param {number} limitBytes
 * @returns {boolean}
 */
export function isAirlockOverLimit(usedBytes, limitBytes) {
  const limit = limitBytes || 0;
  if (limit <= 0) return false;
  return (usedBytes || 0) > limit;
}
