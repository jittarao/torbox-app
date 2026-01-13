import fs from 'fs';
import logger from '../../utils/logger.js';

/**
 * Validate authId format (64-character hex string)
 * @param {string} authId - Auth ID to validate
 * @returns {boolean} - True if valid
 */
export function validateAuthId(authId) {
  return /^[a-f0-9]{64}$/.test(authId);
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size (e.g., "1.23 MB")
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return null;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Get database file statistics
 * @param {string} dbPath - Path to database file
 * @returns {Object|null} - Database stats or null if file doesn't exist
 */
export function getDatabaseStats(dbPath) {
  try {
    if (!fs.existsSync(dbPath)) {
      return { exists: false, path: dbPath };
    }

    const stats = fs.statSync(dbPath);
    return {
      exists: true,
      path: dbPath,
      size: stats.size,
      size_formatted: formatBytes(stats.size),
      modified: stats.mtime,
      created: stats.birthtime,
    };
  } catch (error) {
    logger.warn('Error getting database stats', { dbPath, error: error.message });
    return null;
  }
}

/**
 * Get table counts from a database
 * @param {Object} db - Database connection
 * @param {string[]} tables - Array of table names
 * @returns {Object} - Object with table counts
 */
export function getTableCounts(db, tables) {
  const tableCounts = {};

  for (const table of tables) {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
      tableCounts[table] = count?.count || 0;
    } catch (error) {
      // Table might not exist or error querying
      tableCounts[table] = null;
    }
  }

  return tableCounts;
}

/**
 * Parse pagination parameters from request
 * @param {Object} req - Express request object
 * @returns {Object} - Pagination parameters { page, limit, offset }
 */
export function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 1000));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export function sendSuccess(res, data, statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    ...data,
  });
}

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {Object} context - Additional context for logging
 */
export function sendError(res, error, statusCode = 500, context = {}) {
  if (context.endpoint) {
    logger.error(`Error in ${context.endpoint}`, error, context);
  }

  res.status(statusCode).json({
    success: false,
    error: typeof error === 'string' ? error : error.message,
  });
}

/**
 * Handle async route errors
 * @param {Function} fn - Async route handler
 * @returns {Function} - Wrapped route handler with error handling
 */
export function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      sendError(res, error, 500, {
        endpoint: req.originalUrl || req.url,
        authId: req.params.authId,
      });
    }
  };
}

/**
 * Validate and return authId from request params
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {string|null} - Validated authId or null if invalid
 */
export function validateAuthIdParam(req, res) {
  const { authId } = req.params;

  if (!validateAuthId(authId)) {
    sendError(res, 'Invalid authId format', 400);
    return null;
  }

  return authId;
}

/**
 * Get user database with error handling
 * @param {Object} backend - Backend instance
 * @param {string} authId - User auth ID
 * @returns {Object|null} - User database or null if error
 */
export async function getUserDatabaseSafe(backend, authId) {
  try {
    return await backend.userDatabaseManager.getUserDatabase(authId);
  } catch (error) {
    logger.warn('Error getting user database', { authId, error: error.message });
    return null;
  }
}
