import logger from '../utils/logger.js';

/**
 * Admin authentication middleware
 * Validates admin API key from environment variable
 */
export function adminAuthMiddleware(req, res, next) {
  const adminApiKey = process.env.ADMIN_API_KEY;
  
  if (!adminApiKey) {
    logger.warn('Admin API key not configured', {
      endpoint: req.originalUrl || req.url,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return res.status(503).json({
      success: false,
      error: 'Admin access not configured',
      message: 'ADMIN_API_KEY environment variable is not set'
    });
  }

  // Get admin key from header, query param, or body
  const providedKey = req.headers['x-admin-key'] || 
                     req.query.adminKey || 
                     req.body.adminKey;

  if (!providedKey) {
    logger.warn('Admin authentication attempt without key', {
      endpoint: req.originalUrl || req.url,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return res.status(401).json({
      success: false,
      error: 'Admin authentication required',
      message: 'Provide admin key via x-admin-key header, adminKey query param, or adminKey in body'
    });
  }

  // Constant-time comparison to prevent timing attacks
  if (providedKey !== adminApiKey) {
    logger.warn('Invalid admin authentication attempt', {
      endpoint: req.originalUrl || req.url,
      ip: req.ip || req.connection?.remoteAddress,
    });
    return res.status(403).json({
      success: false,
      error: 'Invalid admin key',
      message: 'The provided admin key is incorrect'
    });
  }

  // Log successful admin access
  logger.info('Admin access granted', {
    endpoint: req.originalUrl || req.url,
    ip: req.ip || req.connection?.remoteAddress,
    method: req.method,
  });

  // Attach admin flag to request
  req.isAdmin = true;
  next();
}

/**
 * Admin rate limiter configuration
 * Stricter than user rate limits
 */
export function createAdminRateLimiter(rateLimit) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX || '100', 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Use IP address for rate limiting
      return req.ip || req.connection?.remoteAddress || 'unknown';
    },
    handler: (req, res) => {
      logger.warn('Admin rate limit exceeded', {
        ip: req.ip || req.connection?.remoteAddress,
        endpoint: req.originalUrl || req.url,
      });
      res.status(429).json({
        success: false,
        error: 'Too many admin requests',
        detail: 'Admin rate limit exceeded. Please wait before making more requests.'
      });
    }
  });
}
