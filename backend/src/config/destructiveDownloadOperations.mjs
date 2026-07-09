/** Destructive download operations blocked while a download is protected. */
export const DESTRUCTIVE_DOWNLOAD_OPERATIONS = ['delete', 'archive', 'stop_seeding'];

/** Skip reason returned when automation skips a protected download. */
export const PROTECTION_SKIP_REASON = 'protected';

const DESTRUCTIVE_SET = new Set(DESTRUCTIVE_DOWNLOAD_OPERATIONS);

/**
 * @param {string} operation - destructive operation or automation action.type
 * @returns {boolean}
 */
export function isDestructiveOperation(operation) {
  return DESTRUCTIVE_SET.has(operation);
}
