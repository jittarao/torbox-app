/**
 * Shared log throttling / dedup helper for hot paths (upload defer, pool exhaustion, etc.).
 */

/**
 * Create a throttled logger that emits at most once per key per ttlMs.
 * Suppressed calls accumulate a count attached as `suppressedSimilar` on the next emit.
 *
 * @param {{ debug?: Function, info?: Function, warn?: Function, error?: Function }} logger
 * @returns {{ log: Function, reset: Function }}
 */
export function createThrottledLogger(logger) {
  const lastAtByKey = new Map();
  const suppressedByKey = new Map();

  /**
   * @param {'debug'|'info'|'warn'|'error'} level
   * @param {string} key - Dedup key (e.g. `defer:webdl` or `auth:abc…`)
   * @param {string} message
   * @param {Object} [meta]
   * @param {number} [ttlMs=60000]
   * @returns {{ emitted: boolean, suppressedCount: number }}
   */
  function log(level, key, message, meta = {}, ttlMs = 60_000) {
    const now = Date.now();
    const lastAt = lastAtByKey.get(key) ?? 0;
    const suppressed = suppressedByKey.get(key) ?? 0;

    if (now - lastAt < ttlMs) {
      suppressedByKey.set(key, suppressed + 1);
      const debugFn = logger.debug?.bind(logger);
      if (typeof debugFn === 'function') {
        debugFn(message, { ...meta, quiet: true });
      }
      return { emitted: false, suppressedCount: suppressed + 1 };
    }

    lastAtByKey.set(key, now);
    suppressedByKey.set(key, 0);

    const payload = {
      ...meta,
      ...(suppressed > 0 ? { suppressedSimilar: suppressed } : {}),
    };
    const fn = logger[level]?.bind(logger) || logger.info?.bind(logger);
    if (typeof fn === 'function') {
      fn(message, payload);
    }
    return { emitted: true, suppressedCount: suppressed };
  }

  function reset(key) {
    if (key) {
      lastAtByKey.delete(key);
      suppressedByKey.delete(key);
      return;
    }
    lastAtByKey.clear();
    suppressedByKey.clear();
  }

  return { log, reset };
}

export default createThrottledLogger;
