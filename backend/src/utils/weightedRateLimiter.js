/**
 * Small in-memory fixed-window rate limiter that supports weighted charges.
 *
 * express-rate-limit always charges one hit per request, which cannot enforce an
 * aggregate per-item budget for bulk reads: a single request carrying N ids must
 * consume roughly N tokens from the same budget as N single-id polls. This helper
 * is shared by the single upload-status route and the bulk status route so both
 * draw down one per-user budget.
 */

/**
 * @param {object} options
 * @param {number} options.windowMs
 * @param {number} options.max            Total weight allowed per window.
 * @param {string} options.message        `error` string for the 429 body.
 * @param {string} [options.detail]       `detail` string for the 429 body.
 * @param {(req: import('express').Request) => string} [options.keyGenerator]
 */
export function createWeightedRateLimiter({ windowMs, max, message, detail, keyGenerator }) {
  /** @type {Map<string, { count: number, resetTime: number }>} */
  const buckets = new Map();

  function getKey(req) {
    const key = keyGenerator ? keyGenerator(req) : req.validatedAuthId || req.ip;
    return key || 'unknown';
  }

  function pruneExpired(now) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetTime <= now) {
        buckets.delete(key);
      }
    }
  }

  function setHeaders(res, bucket, remaining) {
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetTime / 1000)));
    res.setHeader('RateLimit-Policy', `${max};w=${Math.ceil(windowMs / 1000)}`);
  }

  /**
   * Charge `weight` tokens for the request key.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {number} [weight]
   * @returns {boolean} true when allowed (tokens charged); false when a 429 was sent.
   */
  function consume(req, res, weight = 1) {
    const now = Date.now();
    if (buckets.size > 1000) {
      pruneExpired(now);
    }

    const key = getKey(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetTime <= now) {
      bucket = { count: 0, resetTime: now + windowMs };
      buckets.set(key, bucket);
    }

    const cost = Number.isFinite(weight) && weight > 0 ? Math.floor(weight) : 1;
    const remaining = max - bucket.count;

    if (remaining < cost) {
      setHeaders(res, bucket, remaining);
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetTime - now) / 1000))));
      res.status(429).json({ success: false, error: message, detail });
      return false;
    }

    bucket.count += cost;
    setHeaders(res, bucket, max - bucket.count);
    return true;
  }

  /**
   * Express middleware charging a fixed weight (default 1).
   * @param {number} [weight]
   */
  function middleware(weight = 1) {
    return (req, res, next) => {
      if (consume(req, res, weight)) {
        next();
      }
    };
  }

  return { consume, middleware };
}
