/**
 * Validation utilities and middleware
 */
import { hashApiKey } from '../utils/crypto.js';

/** Minimum length for API key before hashing (avoids hashing arbitrary probe strings) */
const MIN_API_KEY_LENGTH = 16;

/**
 * Validate API key format before hashing (length and basic character set).
 * Used to avoid hashing short or malformed probe values in extractAuthIdMiddleware.
 */
export function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  const trimmed = apiKey.trim();
  return trimmed.length >= MIN_API_KEY_LENGTH && /^[\w\-+.=]+$/i.test(trimmed);
}

/**
 * Validate authId format (64-character hex string)
 */
export function validateAuthId(authId) {
  if (!authId || typeof authId !== 'string') return false;
  // authId should be a hex string (SHA-256 hash = 64 chars)
  return /^[a-f0-9]{64}$/.test(authId);
}

/**
 * Validate numeric ID (positive integer)
 */
export function validateNumericId(id) {
  // Handle null, undefined, or empty string
  if (id === null || id === undefined || id === '') {
    return false;
  }

  // Convert to string first to handle both string and number inputs
  const idStr = String(id).trim();
  if (idStr === '') {
    return false;
  }

  // Parse as integer (base 10)
  const numId = parseInt(idStr, 10);

  // Check if it's a valid positive integer
  // Use Number.isInteger to ensure it's not a float
  return !isNaN(numId) && Number.isInteger(numId) && numId > 0;
}

/**
 * Middleware to validate authId from query, body, or headers
 */
export function validateAuthIdMiddleware(req, res, next) {
  const authId = req.query.authId || req.body.authId || req.headers['x-auth-id'];
  if (!authId) {
    return res.status(400).json({
      success: false,
      error: 'authId required',
    });
  }
  if (!validateAuthId(authId)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid authId format. authId must be a 64-character hexadecimal string.',
    });
  }
  // Attach validated authId to request for use in route handlers
  req.validatedAuthId = authId;
  next();
}

/**
 * Middleware to validate numeric ID from route parameters
 */
export function validateNumericIdMiddleware(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id) {
      return res.status(400).json({
        success: false,
        error: `${paramName} is required`,
      });
    }
    if (!validateNumericId(id)) {
      return res.status(400).json({
        success: false,
        error: `Invalid ${paramName}. Must be a positive integer.`,
      });
    }
    // Attach validated ID to request
    req.validatedIds = req.validatedIds || {};
    req.validatedIds[paramName] = parseInt(id, 10);
    next();
  };
}

/**
 * Middleware to extract authId from API key if authId not provided
 * This allows routes to accept either an API key (x-api-key header) or direct authId
 */
export function extractAuthIdMiddleware(req, res, next) {
  // If authId already validated, use it
  if (req.validatedAuthId) {
    return next();
  }

  // Try to get authId from API key (validate format before hashing to avoid probing)
  const apiKey =
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace('Bearer ', '') ||
    req.body?.apiKey;
  if (apiKey) {
    if (!validateApiKeyFormat(apiKey)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid API key format. API key must be at least 16 characters and use allowed characters.',
      });
    }
    req.validatedAuthId = hashApiKey(apiKey);
    return next();
  }

  // Fall back to validateAuthIdMiddleware
  return validateAuthIdMiddleware(req, res, next);
}

/**
 * Middleware to reject requests whose Content-Length header exceeds the limit.
 * Only checks the Content-Length header (can be absent or spoofed); the real body size
 * limit is enforced by express.json() / body parser. Use this as an early rejection for
 * obviously oversized declared payloads.
 */
export function validateJsonPayloadSize(maxSizeBytes = 10 * 1024 * 1024) {
  return (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      const contentLength = parseInt(req.headers['content-length'], 10);
      if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
        return res.status(413).json({
          success: false,
          error: 'Payload too large',
          detail: `Request body exceeds maximum size of ${maxSizeBytes / 1024 / 1024}MB`,
        });
      }
    }
    next();
  };
}
