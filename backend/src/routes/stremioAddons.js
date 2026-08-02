import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { validateNumericIdMiddleware, validateNumericId } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import { serverErrorPayload } from '../utils/httpErrors.js';
import { safeExternalFetch } from '../utils/safeExternalFetch.js';
import { validateExternalUrl } from '../utils/validateExternalUrl.js';
import MigrationRunner from '../database/MigrationRunner.js';
import {
  validateAndExtractManifest,
  buildStreamUrl,
  mediaIdMatchesPrefixes,
} from '../utils/stremioManifest.js';

const ADDON_SELECT_COLUMNS = `
  id, addon_id, manifest_url, name, version, logo, description,
  manifest_json, resources_json, types_json, id_prefixes_json,
  enabled, sort_order, last_refresh, created_at, updated_at
`;

const MAX_STREMIO_ADDONS = (() => {
  const n = parseInt(process.env.STREMIO_MAX_ADDONS || '25', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 25;
})();

const MAX_TYPE_LEN = 32;
const MAX_MEDIA_ID_LEN = 256;

function parseRateLimitMax(raw, fallback) {
  const n = parseInt(raw || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isSqliteConstraintError(error) {
  const msg = String(error?.message || '');
  return (
    error?.code === 'SQLITE_CONSTRAINT' ||
    error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    /UNIQUE constraint failed/i.test(msg) ||
    /constraint failed/i.test(msg)
  );
}

/**
 * List/detail DTO — omit full manifest blob (clients use typed fields).
 */
function parseAddonRow(row) {
  if (!row) return null;
  const parsed = { ...row };
  parsed.enabled = Boolean(row.enabled);
  try {
    parsed.resources = JSON.parse(row.resources_json);
  } catch {
    parsed.resources = [];
  }
  try {
    parsed.types = JSON.parse(row.types_json);
  } catch {
    parsed.types = [];
  }
  try {
    parsed.id_prefixes = JSON.parse(row.id_prefixes_json);
  } catch {
    parsed.id_prefixes = [];
  }
  delete parsed.manifest_json;
  delete parsed.resources_json;
  delete parsed.types_json;
  delete parsed.id_prefixes_json;
  return parsed;
}

function serviceUnavailable(res) {
  return res.status(503).json({
    success: false,
    error: 'Service is initializing, please try again in a moment',
  });
}

/**
 * Self-heal when a pooled user DB is missing stremio_addons (e.g. connection opened
 * before migration 024, or schema_migrations marked applied without the table).
 */
async function ensureStremioAddonsTable(userDb) {
  const exists = userDb.db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='stremio_addons'")
    .get();
  if (exists) return;

  logger.warn('stremio_addons table missing; reapplying migrations 024/025');
  userDb.db.prepare("DELETE FROM schema_migrations WHERE version IN ('024', '025')").run();
  userDb.schemaVersion = 0;
  if (userDb.migrationRunner) {
    userDb.migrationRunner.clearCache();
    await userDb.migrationRunner.runMigrations();
    userDb.schemaVersion = await MigrationRunner.getLatestMigrationVersionNumber('user');
  }

  const healed = userDb.db
    .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='stremio_addons'")
    .get();
  if (!healed) {
    const err = new Error('stremio_addons schema is unavailable after migration retry');
    err.code = 'STREMIO_SCHEMA_MISSING';
    throw err;
  }
}

async function fetchAndValidateManifest(manifestUrl) {
  const urlCheck = validateExternalUrl(manifestUrl);
  if (!urlCheck.valid) {
    return { ok: false, status: 400, error: urlCheck.reason };
  }

  let response;
  try {
    response = await safeExternalFetch(urlCheck.url);
  } catch (error) {
    const code = error.code || 'NETWORK_ERROR';
    if (code === 'TIMEOUT') {
      return { ok: false, status: 504, error: 'Manifest request timed out', code };
    }
    if (code === 'INVALID_URL' || code === 'SSRF_BLOCKED') {
      return { ok: false, status: 400, error: error.message, code };
    }
    if (code === 'PAYLOAD_TOO_LARGE') {
      return { ok: false, status: 413, error: error.message, code };
    }
    return {
      ok: false,
      status: 502,
      error: error.message || 'Failed to fetch manifest',
      code,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      error: `Manifest fetch failed with HTTP ${response.status}`,
      code: 'HTTP_ERROR',
      httpStatus: response.status,
    };
  }

  if (response.parseError || response.json == null) {
    return {
      ok: false,
      status: 502,
      error: 'Manifest response is not valid JSON',
      code: 'MALFORMED_JSON',
    };
  }

  const extracted = validateAndExtractManifest(response.json);
  if (!extracted.ok) {
    return { ok: false, status: 400, error: extracted.error, code: 'INVALID_MANIFEST' };
  }

  return {
    ok: true,
    manifestUrl: urlCheck.url,
    manifest: response.json,
    extracted: extracted.data,
  };
}

/**
 * Stremio addon routes — CRUD + stream proxy
 */
export function setupStremioAddonsRoutes(app, backend) {
  const { userRateLimiter } = backend;

  const stremioFetchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseRateLimitMax(process.env.STREMIO_FETCH_RATE_LIMIT_MAX, 120),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.validatedAuthId || ipKeyGenerator(req.ip),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many addon fetch requests, please try again later.',
        code: 'STREMIO_FETCH_RATE_LIMIT',
      });
    },
  });

  // GET /api/stremio/addons
  app.get(
    '/api/stremio/addons',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        await ensureStremioAddonsTable(userDb);
        const rows = userDb.db
          .prepare(
            `
            SELECT ${ADDON_SELECT_COLUMNS}
            FROM stremio_addons
            ORDER BY sort_order ASC, id ASC
          `
          )
          .all();

        res.json({ success: true, addons: rows.map(parseAddonRow) });
      } catch (error) {
        logger.error('Error listing stremio addons', error, {
          endpoint: '/api/stremio/addons',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // POST /api/stremio/addons
  app.post(
    '/api/stremio/addons',
    backend.requireRegisteredUser,
    userRateLimiter,
    stremioFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const manifestUrlRaw =
          typeof req.body?.manifest_url === 'string' ? req.body.manifest_url.trim() : '';
        if (!manifestUrlRaw) {
          return res.status(400).json({
            success: false,
            error: 'manifest_url is required',
          });
        }

        const fetched = await fetchAndValidateManifest(manifestUrlRaw);
        if (!fetched.ok) {
          return res.status(fetched.status).json({
            success: false,
            error: fetched.error,
            code: fetched.code,
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        await ensureStremioAddonsTable(userDb);

        const countRow = userDb.db.prepare('SELECT COUNT(*) AS c FROM stremio_addons').get();
        if ((countRow?.c ?? 0) >= MAX_STREMIO_ADDONS) {
          return res.status(400).json({
            success: false,
            error: `Maximum of ${MAX_STREMIO_ADDONS} addons allowed`,
            code: 'ADDON_LIMIT',
          });
        }

        const existingUrl = userDb.db
          .prepare('SELECT id FROM stremio_addons WHERE manifest_url = ?')
          .get(fetched.manifestUrl);
        if (existingUrl) {
          return res.status(409).json({
            success: false,
            error: 'An addon with this manifest URL is already installed',
            code: 'DUPLICATE_URL',
          });
        }

        const existingId = userDb.db
          .prepare('SELECT id FROM stremio_addons WHERE addon_id = ?')
          .get(fetched.extracted.addonId);
        if (existingId) {
          return res.status(409).json({
            success: false,
            error: 'An addon with this id is already installed',
            code: 'DUPLICATE_ADDON_ID',
          });
        }

        const maxOrderResult = userDb.db
          .prepare('SELECT MAX(sort_order) as max_order FROM stremio_addons')
          .get();
        const sortOrder = (maxOrderResult?.max_order ?? -1) + 1;
        const now = new Date().toISOString();
        const { extracted, manifest, manifestUrl } = fetched;

        let result;
        try {
          result = userDb.db
            .prepare(
              `
              INSERT INTO stremio_addons (
                addon_id, manifest_url, name, version, logo, description,
                manifest_json, resources_json, types_json, id_prefixes_json,
                enabled, sort_order, last_refresh, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            `
            )
            .run(
              extracted.addonId,
              manifestUrl,
              extracted.name,
              extracted.version,
              extracted.logo,
              extracted.description,
              JSON.stringify(manifest),
              JSON.stringify(extracted.resources),
              JSON.stringify(extracted.types),
              JSON.stringify(extracted.idPrefixes),
              sortOrder,
              now,
              now,
              now
            );
        } catch (error) {
          if (isSqliteConstraintError(error)) {
            return res.status(409).json({
              success: false,
              error: 'Addon already installed',
              code: 'DUPLICATE',
            });
          }
          throw error;
        }

        const row = userDb.db
          .prepare(`SELECT ${ADDON_SELECT_COLUMNS} FROM stremio_addons WHERE id = ?`)
          .get(result.lastInsertRowid);

        res.status(201).json({ success: true, addon: parseAddonRow(row) });
      } catch (error) {
        if (isSqliteConstraintError(error)) {
          return res.status(409).json({
            success: false,
            error: 'Addon already installed',
            code: 'DUPLICATE',
          });
        }
        logger.error('Error adding stremio addon', error, {
          endpoint: '/api/stremio/addons',
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // PUT /api/stremio/addons/:id — update enabled
  app.put(
    '/api/stremio/addons/:id',
    backend.requireRegisteredUser,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const addonRowId = req.validatedIds.id;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        if (typeof req.body?.enabled !== 'boolean') {
          return res.status(400).json({
            success: false,
            error: 'enabled (boolean) is required',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const existing = userDb.db
          .prepare('SELECT id FROM stremio_addons WHERE id = ?')
          .get(addonRowId);

        if (!existing) {
          return res.status(404).json({ success: false, error: 'Addon not found' });
        }

        userDb.db
          .prepare(
            `
            UPDATE stremio_addons
            SET enabled = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
          )
          .run(req.body.enabled ? 1 : 0, addonRowId);

        const row = userDb.db
          .prepare(`SELECT ${ADDON_SELECT_COLUMNS} FROM stremio_addons WHERE id = ?`)
          .get(addonRowId);

        res.json({ success: true, addon: parseAddonRow(row) });
      } catch (error) {
        logger.error('Error updating stremio addon', error, {
          endpoint: `/api/stremio/addons/${req.params.id}`,
          method: 'PUT',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // POST /api/stremio/addons/:id/refresh
  app.post(
    '/api/stremio/addons/:id/refresh',
    backend.requireRegisteredUser,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    stremioFetchLimiter,
    async (req, res) => {
      let holdingConnection = false;
      try {
        const authId = req.validatedAuthId;
        const addonRowId = req.validatedIds.id;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        let userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        holdingConnection = true;
        const existing = userDb.db
          .prepare(`SELECT ${ADDON_SELECT_COLUMNS} FROM stremio_addons WHERE id = ?`)
          .get(addonRowId);

        if (!existing) {
          return res.status(404).json({ success: false, error: 'Addon not found' });
        }

        const manifestUrl = existing.manifest_url;
        const previousAddonId = existing.addon_id;
        backend.userDatabaseManager.releaseConnection(authId);
        holdingConnection = false;

        const fetched = await fetchAndValidateManifest(manifestUrl);
        if (!fetched.ok) {
          return res.status(fetched.status).json({
            success: false,
            error: fetched.error,
            code: fetched.code,
          });
        }

        userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        holdingConnection = true;

        if (fetched.extracted.addonId !== previousAddonId) {
          const collision = userDb.db
            .prepare('SELECT id FROM stremio_addons WHERE addon_id = ? AND id != ?')
            .get(fetched.extracted.addonId, addonRowId);
          if (collision) {
            return res.status(409).json({
              success: false,
              error: 'Refreshed manifest id collides with another installed addon',
              code: 'DUPLICATE_ADDON_ID',
            });
          }
        }

        const now = new Date().toISOString();
        const { extracted, manifest } = fetched;

        try {
          userDb.db
            .prepare(
              `
              UPDATE stremio_addons SET
                addon_id = ?,
                name = ?,
                version = ?,
                logo = ?,
                description = ?,
                manifest_json = ?,
                resources_json = ?,
                types_json = ?,
                id_prefixes_json = ?,
                last_refresh = ?,
                updated_at = ?
              WHERE id = ?
            `
            )
            .run(
              extracted.addonId,
              extracted.name,
              extracted.version,
              extracted.logo,
              extracted.description,
              JSON.stringify(manifest),
              JSON.stringify(extracted.resources),
              JSON.stringify(extracted.types),
              JSON.stringify(extracted.idPrefixes),
              now,
              now,
              addonRowId
            );
        } catch (error) {
          if (isSqliteConstraintError(error)) {
            return res.status(409).json({
              success: false,
              error: 'Refreshed manifest id collides with another installed addon',
              code: 'DUPLICATE_ADDON_ID',
            });
          }
          throw error;
        }

        const row = userDb.db
          .prepare(`SELECT ${ADDON_SELECT_COLUMNS} FROM stremio_addons WHERE id = ?`)
          .get(addonRowId);

        res.json({ success: true, addon: parseAddonRow(row) });
      } catch (error) {
        logger.error('Error refreshing stremio addon', error, {
          endpoint: `/api/stremio/addons/${req.params.id}/refresh`,
          method: 'POST',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (holdingConnection && req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // PATCH /api/stremio/addons/reorder
  app.patch(
    '/api/stremio/addons/reorder',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const { ids } = req.body || {};
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'ids must be a non-empty array',
          });
        }

        const normalizedIds = ids.map((id) => {
          if (!validateNumericId(id)) return null;
          return parseInt(String(id), 10);
        });

        if (normalizedIds.some((id) => id === null)) {
          return res.status(400).json({
            success: false,
            error: 'ids must contain positive integers',
          });
        }

        if (new Set(normalizedIds).size !== normalizedIds.length) {
          return res.status(400).json({
            success: false,
            error: 'ids must not contain duplicates',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const existingIds = userDb.db
          .prepare('SELECT id FROM stremio_addons ORDER BY id ASC')
          .all()
          .map((row) => row.id);

        if (normalizedIds.length !== existingIds.length) {
          return res.status(400).json({
            success: false,
            error: 'ids must include every addon',
          });
        }

        const existingIdSet = new Set(existingIds);
        if (!normalizedIds.every((id) => existingIdSet.has(id))) {
          return res.status(400).json({
            success: false,
            error: 'ids contain unknown addon ids',
          });
        }

        const update = userDb.db.prepare(
          `
          UPDATE stremio_addons
          SET sort_order = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
        );

        userDb.db.transaction(() => {
          normalizedIds.forEach((id, index) => {
            update.run(index, id);
          });
        })();

        res.json({ success: true });
      } catch (error) {
        logger.error('Error reordering stremio addons', error, {
          endpoint: '/api/stremio/addons/reorder',
          method: 'PATCH',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // DELETE /api/stremio/addons/:id
  app.delete(
    '/api/stremio/addons/:id',
    backend.requireRegisteredUser,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        const addonRowId = req.validatedIds.id;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const existing = userDb.db
          .prepare('SELECT id FROM stremio_addons WHERE id = ?')
          .get(addonRowId);

        if (!existing) {
          return res.status(404).json({ success: false, error: 'Addon not found' });
        }

        userDb.db.prepare('DELETE FROM stremio_addons WHERE id = ?').run(addonRowId);

        res.json({ success: true, message: 'Addon removed successfully' });
      } catch (error) {
        logger.error('Error deleting stremio addon', error, {
          endpoint: `/api/stremio/addons/${req.params.id}`,
          method: 'DELETE',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );

  // GET /api/stremio/addons/:id/stream?type=&mediaId=
  app.get(
    '/api/stremio/addons/:id/stream',
    backend.requireRegisteredUser,
    validateNumericIdMiddleware('id'),
    userRateLimiter,
    stremioFetchLimiter,
    async (req, res) => {
      const started = Date.now();
      let holdingConnection = false;
      try {
        const authId = req.validatedAuthId;
        const addonRowId = req.validatedIds.id;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
        const mediaId = typeof req.query.mediaId === 'string' ? req.query.mediaId.trim() : '';

        if (!type || !mediaId) {
          return res.status(400).json({
            success: false,
            error: 'type and mediaId query parameters are required',
          });
        }

        if (type.length > MAX_TYPE_LEN || !/^[a-zA-Z0-9_-]+$/.test(type)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid type parameter',
            code: 'INVALID_TYPE',
          });
        }

        if (mediaId.length > MAX_MEDIA_ID_LEN) {
          return res.status(400).json({
            success: false,
            error: 'mediaId exceeds maximum length',
            code: 'INVALID_MEDIA_ID',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        holdingConnection = true;
        const existing = userDb.db
          .prepare(`SELECT ${ADDON_SELECT_COLUMNS} FROM stremio_addons WHERE id = ?`)
          .get(addonRowId);

        if (!existing) {
          return res.status(404).json({ success: false, error: 'Addon not found' });
        }

        if (!existing.enabled) {
          return res.status(400).json({
            success: false,
            error: 'Addon is disabled',
            code: 'DISABLED',
          });
        }

        let types = [];
        let idPrefixes = [];
        try {
          types = JSON.parse(existing.types_json);
        } catch {
          types = [];
        }
        try {
          idPrefixes = JSON.parse(existing.id_prefixes_json);
        } catch {
          idPrefixes = [];
        }

        if (Array.isArray(types) && types.length > 0 && !types.includes(type)) {
          return res.status(400).json({
            success: false,
            error: `Addon does not support type "${type}"`,
            code: 'UNSUPPORTED_TYPE',
          });
        }

        if (!mediaIdMatchesPrefixes(mediaId, idPrefixes)) {
          return res.status(400).json({
            success: false,
            error: 'mediaId does not match addon idPrefixes',
            code: 'UNSUPPORTED_ID_PREFIX',
          });
        }

        let streamUrl;
        try {
          streamUrl = buildStreamUrl(existing.manifest_url, type, mediaId);
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: error.message || 'Invalid stream URL',
          });
        }

        const addonMeta = {
          addon_id: existing.addon_id,
          name: existing.name,
          logo: existing.logo,
        };

        backend.userDatabaseManager.releaseConnection(authId);
        holdingConnection = false;

        let response;
        try {
          response = await safeExternalFetch(streamUrl);
        } catch (error) {
          const code = error.code || 'NETWORK_ERROR';
          logger.info('Stremio stream fetch failed', {
            addonId: addonMeta.addon_id,
            type,
            code,
            durationMs: Date.now() - started,
          });
          const status =
            code === 'TIMEOUT'
              ? 504
              : code === 'SSRF_BLOCKED' || code === 'INVALID_URL'
                ? 400
                : 502;
          return res.status(status).json({
            success: false,
            error: error.message || 'Stream fetch failed',
            code,
            addon_id: addonMeta.addon_id,
          });
        }

        if (!response.ok) {
          logger.info('Stremio stream HTTP error', {
            addonId: addonMeta.addon_id,
            type,
            httpStatus: response.status,
            durationMs: Date.now() - started,
          });
          return res.status(502).json({
            success: false,
            error: `Stream fetch failed with HTTP ${response.status}`,
            code: 'HTTP_ERROR',
            httpStatus: response.status,
            addon_id: addonMeta.addon_id,
          });
        }

        if (response.parseError || response.json == null || typeof response.json !== 'object') {
          return res.status(502).json({
            success: false,
            error: 'Stream response is not valid JSON',
            code: 'MALFORMED_JSON',
            addon_id: addonMeta.addon_id,
          });
        }

        const streams = Array.isArray(response.json.streams) ? response.json.streams : [];

        res.json({
          success: true,
          addon_id: addonMeta.addon_id,
          name: addonMeta.name,
          logo: addonMeta.logo,
          type,
          mediaId,
          streams,
        });
      } catch (error) {
        logger.error('Error proxying stremio stream', error, {
          endpoint: `/api/stremio/addons/${req.params.id}/stream`,
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        if (holdingConnection && req.validatedAuthId && backend.userDatabaseManager) {
          backend.userDatabaseManager.releaseConnection(req.validatedAuthId);
        }
      }
    }
  );
}
