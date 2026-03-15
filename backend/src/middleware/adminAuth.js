import crypto from 'crypto';
import logger from '../utils/logger.js';

// Constants
const ADMIN_API_KEY_HEADER = 'x-admin-key';
const ADMIN_KEY_QUERY_PARAM = 'adminKey';
const ADMIN_KEY_BODY_PARAM = 'adminKey';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_RATE_LIMIT_MAX = 100;

/**
 * Extract client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Extract request endpoint URL
 * @param {Object} req - Express request object
 * @returns {string} - Request endpoint URL
 */
function getEndpoint(req) {
  return req.originalUrl || req.url;
}

/**
 * Build request context for logging
 * @param {Object} req - Express request object
 * @returns {Object} - Logging context
 */
function getRequestContext(req) {
  return {
    endpoint: getEndpoint(req),
    ip: getClientIp(req),
    method: req.method,
  };
}

/**
 * Extract admin key from request (header preferred; query/body allowed but logged)
 * @param {Object} req - Express request object
 * @returns {{ key: string|null, source: 'header'|'query'|'body'|null }} - Key and source
 */
function extractAdminKey(req) {
  if (req.headers[ADMIN_API_KEY_HEADER]) {
    return { key: req.headers[ADMIN_API_KEY_HEADER], source: 'header' };
  }
  if (req.query[ADMIN_KEY_QUERY_PARAM]) {
    return { key: req.query[ADMIN_KEY_QUERY_PARAM], source: 'query' };
  }
  if (req.body?.[ADMIN_KEY_BODY_PARAM]) {
    return { key: req.body[ADMIN_KEY_BODY_PARAM], source: 'body' };
  }
  return { key: null, source: null };
}

/**
 * Perform constant-time comparison via SHA-256 hashes (fixed length, no length leak).
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 * @returns {boolean} - True if strings are equal
 */
function timingSafeCompare(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return ha.length === hb.length && crypto.timingSafeEqual(ha, hb);
}

/**
 * Send error response with consistent structure
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} error - Error type
 * @param {string} message - Error message
 */
function sendErrorResponse(res, statusCode, error, message) {
  res.status(statusCode).json({
    success: false,
    error,
    message,
  });
}

/**
 * Get admin API key from environment
 * @returns {string|undefined} - Admin API key
 */
function getAdminApiKey() {
  return process.env.ADMIN_API_KEY;
}

/**
 * Validate admin API key configuration
 * @returns {Object} - Validation result with key or error
 */
function validateAdminConfig() {
  const adminApiKey = getAdminApiKey();

  if (!adminApiKey) {
    return {
      valid: false,
      error: {
        statusCode: 503,
        error: 'Admin access not configured',
        message: 'ADMIN_API_KEY environment variable is not set',
      },
    };
  }

  return { valid: true, key: adminApiKey };
}

/**
 * Admin authentication middleware
 * Validates admin API key from environment variable
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function adminAuthMiddleware(req, res, next) {
  const config = validateAdminConfig();

  if (!config.valid) {
    const context = getRequestContext(req);
    logger.warn('Admin API key not configured', context);
    return sendErrorResponse(
      res,
      config.error.statusCode,
      config.error.error,
      config.error.message
    );
  }

  const { key: providedKey, source: keySource } = extractAdminKey(req);

  if (!providedKey) {
    const context = getRequestContext(req);
    logger.warn('Admin authentication attempt without key', context);
    return sendErrorResponse(
      res,
      401,
      'Admin authentication required',
      'Provide admin key via x-admin-key header'
    );
  }

  // In production, reject admin key via query or body (may be logged by proxies/servers)
  if (process.env.NODE_ENV === 'production' && keySource !== 'header') {
    const context = getRequestContext(req);
    logger.warn('Admin key must be provided via x-admin-key header in production', {
      ...context,
      source: keySource,
    });
    return sendErrorResponse(
      res,
      401,
      'Admin authentication required',
      'Provide admin key via x-admin-key header only'
    );
  }

  if (keySource === 'query' || keySource === 'body') {
    const context = getRequestContext(req);
    logger.warn('Admin key provided via query or body; prefer x-admin-key header', {
      ...context,
      source: keySource,
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeCompare(providedKey, config.key)) {
    const context = getRequestContext(req);
    logger.warn('Invalid admin authentication attempt', context);
    return sendErrorResponse(res, 403, 'Invalid admin key', 'The provided admin key is incorrect');
  }

  // Log successful admin access
  const context = getRequestContext(req);
  logger.info('Admin access granted', context);

  // Attach admin flag to request
  req.isAdmin = true;
  next();
}

/**
 * Get rate limit configuration
 * @returns {Object} - Rate limit configuration
 */
function getRateLimitConfig() {
  const max = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || String(DEFAULT_RATE_LIMIT_MAX), 10);

  return {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: isNaN(max) ? DEFAULT_RATE_LIMIT_MAX : max,
  };
}

/**
 * Admin rate limiter configuration
 * Stricter than user rate limits
 *
 * @param {Function} rateLimit - Rate limit middleware factory
 * @returns {Function} - Configured rate limiter middleware
 */
export function createAdminRateLimiter(rateLimit) {
  const config = getRateLimitConfig();

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => getClientIp(req),
    handler: (req, res) => {
      const context = getRequestContext(req);
      logger.warn('Admin rate limit exceeded', context);

      res.status(429).json({
        success: false,
        error: 'Too many admin requests',
        message: 'Admin rate limit exceeded. Please wait before making more requests.',
      });
    },
  });
}
