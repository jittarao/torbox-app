/** Decimal TB (SI) — matches TorBox monthly transfer quotas. */
const TB = 1000 ** 4;

/** Minimum monthly floors per plan (TorBox abuse policy). Plan IDs match userProfile.getPlanName. */
const PLAN_MONTHLY_FLOOR_BYTES = {
  0: 5 * TB,
  1: 10 * TB,
  2: 30 * TB,
  3: 20 * TB,
};

const USAGE_WARNING_PERCENT = 70;
const USAGE_DANGER_PERCENT = 90;

/**
 * @param {Array<{ bytes_downloaded?: number }>} bandwidth
 * @returns {number}
 */
export function sumBandwidthBytes(bandwidth) {
  if (!Array.isArray(bandwidth)) return 0;
  return bandwidth.reduce((sum, point) => sum + (point.bytes_downloaded || 0), 0);
}

/**
 * @param {number} planId
 * @returns {number|null}
 */
export function getPlanFloorBytes(planId) {
  if (planId == null || !(planId in PLAN_MONTHLY_FLOOR_BYTES)) {
    return null;
  }
  return PLAN_MONTHLY_FLOOR_BYTES[planId];
}

/**
 * @param {number} usedBytes
 * @param {number|null|undefined} planId
 * @returns {number|null} Percent 0–100+, or null if not computable
 */
export function getUsagePercent(usedBytes, planId) {
  const limitBytes = getPlanFloorBytes(planId);
  if (limitBytes == null || limitBytes <= 0) return null;
  return (usedBytes / limitBytes) * 100;
}

/**
 * @param {number|null} percent
 * @returns {'warning'|'danger'|null}
 */
export function getUsageLevel(percent) {
  if (percent == null) return null;
  if (percent >= USAGE_DANGER_PERCENT) return 'danger';
  if (percent >= USAGE_WARNING_PERCENT) return 'warning';
  return null;
}
