/**
 * User authentication: require TorBox API key proof and active registry membership.
 */
import crypto from 'crypto';
import { hashApiKey } from '../utils/crypto.js';
import logger from '../utils/logger.js';

const SERVICE_SECRET_HEADER = 'x-backend-service-secret';
const MIN_API_KEY_LENGTH = 16;

let internalAuthOptionalWarned = false;
let legacyAuthIdWarned = false;

function validateApiKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  const trimmed = apiKey.trim();
  return trimmed.length >= MIN_API_KEY_LENGTH && /^[\w\-+.=]+$/i.test(trimmed);
}

function validateAuthIdFormat(authId) {
  return authId && typeof authId === 'string' && /^[a-f0-9]{64}$/.test(authId);
}

function extractApiKey(req) {
  return (
    req.headers['x-api-key'] ||
    req.headers['authorization']?.replace(/^Bearer\s+/i, '') ||
    req.body?.apiKey ||
    null
  );
}

function extractDeclaredAuthId(req) {
  return req.query.authId || req.body?.authId || req.headers['x-auth-id'] || null;
}

function timingSafeCompare(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isServiceSecretConfigured() {
  const secret = process.env.BACKEND_SERVICE_SECRET;
  return typeof secret === 'string' && secret.trim().length >= 16;
}

function isApiKeyRequired() {
  const v = process.env.BACKEND_REQUIRE_API_KEY?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

/**
 * Verify user exists with active registry + API key. Returns false if response was sent.
 */
function attachRegisteredUser(masterDb, authId, res) {
  if (!masterDb?.initialized) {
    res.status(503).json({
      success: false,
      error: 'Database not ready',
    });
    return false;
  }

  const keyRow = masterDb.getApiKey(authId);
  if (!keyRow) {
    const reason = masterDb.getApiKeyUnavailableReason(authId);
    const status = reason === 'inactive' ? 403 : 404;
    res.status(status).json({
      success: false,
      error: reason === 'inactive' ? 'API key inactive' : 'User not registered',
    });
    return false;
  }

  const registry = masterDb.getQuery(
    "SELECT status FROM user_registry WHERE auth_id = ? AND status = 'active'",
    [authId]
  );
  if (!registry) {
    res.status(403).json({
      success: false,
      error: 'User account inactive',
    });
    return false;
  }

  return true;
}

/**
 * Middleware for internal-only routes (api key registration, status).
 * Optional: when BACKEND_SERVICE_SECRET is set (≥16 chars), requires x-backend-service-secret.
 * When unset, allows requests (backward compatible for existing self-hosted installs).
 */
export function requireInternalServiceAuth(req, res, next) {
  if (!isServiceSecretConfigured()) {
    if (!internalAuthOptionalWarned) {
      internalAuthOptionalWarned = true;
      logger.warn(
        'BACKEND_SERVICE_SECRET is not set; /api/backend/api-key* routes accept unauthenticated requests. Set the same secret on frontend and backend for defense in depth.'
      );
    }
    return next();
  }

  const secret = process.env.BACKEND_SERVICE_SECRET.trim();
  const provided = req.headers[SERVICE_SECRET_HEADER];
  if (!provided || !timingSafeCompare(provided, secret)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      detail: 'Valid x-backend-service-secret header required',
    });
  }

  next();
}

/**
 * Require an active registered user.
 * Preferred: x-api-key (or Bearer) matching a registered user.
 * Legacy (default): authId query/body/header when no API key (Next.js proxies); disable with BACKEND_REQUIRE_API_KEY=true.
 * @param {() => import('../database/Database.js').default} getMasterDatabase
 */
export function createRequireRegisteredUser(getMasterDatabase) {
  return function requireRegisteredUser(req, res, next) {
    const masterDb = getMasterDatabase();
    const apiKey = extractApiKey(req);

    if (apiKey) {
      if (!validateApiKeyFormat(apiKey)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid API key format',
        });
      }

      const authIdFromKey = hashApiKey(apiKey);
      const declaredAuthId = extractDeclaredAuthId(req);
      if (declaredAuthId && declaredAuthId !== authIdFromKey) {
        return res.status(403).json({
          success: false,
          error: 'authId does not match API key',
        });
      }

      if (!attachRegisteredUser(masterDb, authIdFromKey, res)) {
        return;
      }

      req.validatedAuthId = authIdFromKey;
      return next();
    }

    if (isApiKeyRequired()) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        detail:
          'Provide TorBox API key via x-api-key header. BACKEND_REQUIRE_API_KEY is enabled on this server.',
      });
    }

    const declaredAuthId = extractDeclaredAuthId(req);
    if (!validateAuthIdFormat(declaredAuthId)) {
      return res.status(401).json({
        success: false,
        error: 'API key or authId required',
        detail:
          'Provide x-api-key, or authId (legacy). Set BACKEND_REQUIRE_API_KEY=true to require API keys only.',
      });
    }

    if (!attachRegisteredUser(masterDb, declaredAuthId, res)) {
      return;
    }

    if (!legacyAuthIdWarned) {
      legacyAuthIdWarned = true;
      logger.warn(
        'User routes accept authId without x-api-key (legacy self-host mode). Set BACKEND_REQUIRE_API_KEY=true to require API key proof on every request.'
      );
    }

    req.validatedAuthId = declaredAuthId;
    next();
  };
}
