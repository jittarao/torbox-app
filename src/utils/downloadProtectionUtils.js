/**
 * @param {Array<string|number>} [protectedIds]
 * @returns {Record<string, true>}
 */
export function protectedIdsToMap(protectedIds) {
  /** @type {Record<string, true>} */
  const map = {};
  for (const rawId of protectedIds || []) {
    const id = String(rawId);
    if (id) {
      map[id] = true;
    }
  }
  return map;
}

/**
 * @param {object | null | undefined} item
 * @returns {boolean}
 */
export function isItemProtected(item) {
  return item?.is_protected === true;
}

/**
 * @param {object[]} items
 * @returns {{ allowed: object[], blocked: object[] }}
 */
export function partitionItemsByProtection(items) {
  const allowed = [];
  const blocked = [];

  for (const item of items) {
    if (isItemProtected(item)) {
      blocked.push(item);
    } else {
      allowed.push(item);
    }
  }

  return { allowed, blocked };
}

/**
 * @param {number} skippedCount
 * @param {(key: string, values?: object) => string} t
 * @returns {string | null}
 */
export function formatProtectedSkipSuffix(skippedCount, t) {
  if (!skippedCount) return null;
  return t('protectedSkipped', { count: skippedCount });
}
