/**
 * Validation utilities and middleware
 */

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
 * Middleware to validate JSON payload size
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
