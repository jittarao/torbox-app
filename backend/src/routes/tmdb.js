import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import logger from '../utils/logger.js';
import { serverErrorPayload } from '../utils/httpErrors.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import {
  validateTmdbApiKey,
  searchTmdbTitles,
  fetchTvDetails,
  fetchTvSeason,
  findTmdbByImdbId,
  findTmdbByTmdbId,
  tmdbErrorPayload,
} from '../utils/tmdbClient.js';

const MAX_QUERY_LEN = 200;
/** v3 keys are short; v4 read access tokens are JWTs (often 800–1500 chars). */
const MAX_API_KEY_LEN = 2048;

function parseRateLimitMax(raw, fallback) {
  const n = parseInt(raw || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function serviceUnavailable(res) {
  return res.status(503).json({
    success: false,
    error: 'Service is initializing, please try again in a moment',
  });
}

function getEncryptedKey(userDb) {
  const row = userDb.db
    .prepare('SELECT encrypted_api_key FROM tmdb_credentials WHERE id = 1')
    .get();
  return row?.encrypted_api_key || null;
}

function releaseUserDb(backend, authId) {
  if (authId && backend.userDatabaseManager) {
    backend.userDatabaseManager.releaseConnection(authId);
  }
}

/**
 * @returns {{ ok: true, apiKey: string } | { ok: false, status: number, body: object }}
 */
function loadDecryptedKey(userDb) {
  const encrypted = getEncryptedKey(userDb);
  if (!encrypted) {
    return {
      ok: false,
      status: 404,
      body: {
        success: false,
        error: 'TMDB API key is not configured',
        code: 'TMDB_NOT_CONFIGURED',
      },
    };
  }
  try {
    const apiKey = decrypt(encrypted);
    if (!apiKey) {
      return {
        ok: false,
        status: 500,
        body: {
          success: false,
          error: 'Failed to decrypt TMDB API key',
          code: 'TMDB_DECRYPT_FAILED',
        },
      };
    }
    return { ok: true, apiKey };
  } catch {
    return {
      ok: false,
      status: 500,
      body: {
        success: false,
        error: 'Failed to decrypt TMDB API key',
        code: 'TMDB_DECRYPT_FAILED',
      },
    };
  }
}

function mapTmdbError(error, res) {
  const { status, body } = tmdbErrorPayload(error);
  return res.status(status).json(body);
}

export function setupTmdbRoutes(app, backend) {
  const { userRateLimiter } = backend;

  const tmdbFetchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: parseRateLimitMax(process.env.TMDB_FETCH_RATE_LIMIT_MAX, 60),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.validatedAuthId || ipKeyGenerator(req.ip),
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'Too many TMDB requests, please try again later.',
        code: 'TMDB_FETCH_RATE_LIMIT',
      });
    },
  });

  // GET /api/tmdb/credentials
  app.get(
    '/api/tmdb/credentials',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const configured = Boolean(getEncryptedKey(userDb));
        res.json({ success: true, configured });
      } catch (error) {
        logger.error('Error reading TMDB credentials status', error, {
          endpoint: '/api/tmdb/credentials',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // PUT /api/tmdb/credentials
  app.put(
    '/api/tmdb/credentials',
    backend.requireRegisteredUser,
    userRateLimiter,
    tmdbFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const apiKeyRaw = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
        if (!apiKeyRaw) {
          return res.status(400).json({
            success: false,
            error: 'apiKey is required',
            code: 'TMDB_KEY_REQUIRED',
          });
        }
        if (apiKeyRaw.length > MAX_API_KEY_LEN) {
          return res.status(400).json({
            success: false,
            error: 'apiKey is too long',
            code: 'TMDB_KEY_INVALID',
          });
        }

        const validation = await validateTmdbApiKey(apiKeyRaw);
        if (!validation.ok) {
          return res.status(validation.status).json({
            success: false,
            error: validation.error,
            code: validation.code,
          });
        }

        const encrypted = encrypt(apiKeyRaw);
        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        userDb.db
          .prepare(
            `
            INSERT INTO tmdb_credentials (id, encrypted_api_key, updated_at)
            VALUES (1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              encrypted_api_key = excluded.encrypted_api_key,
              updated_at = CURRENT_TIMESTAMP
          `
          )
          .run(encrypted);

        res.json({ success: true, configured: true });
      } catch (error) {
        logger.error('Error saving TMDB credentials', error, {
          endpoint: '/api/tmdb/credentials',
          method: 'PUT',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // DELETE /api/tmdb/credentials
  app.delete(
    '/api/tmdb/credentials',
    backend.requireRegisteredUser,
    userRateLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        userDb.db.prepare('DELETE FROM tmdb_credentials WHERE id = 1').run();
        res.json({ success: true, configured: false });
      } catch (error) {
        logger.error('Error deleting TMDB credentials', error, {
          endpoint: '/api/tmdb/credentials',
          method: 'DELETE',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // GET /api/tmdb/search?q=&allowTmdbFallback=
  app.get(
    '/api/tmdb/search',
    backend.requireRegisteredUser,
    userRateLimiter,
    tmdbFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        if (!q) {
          return res.status(400).json({
            success: false,
            error: 'q is required',
            code: 'TMDB_QUERY_REQUIRED',
          });
        }
        if (q.length > MAX_QUERY_LEN) {
          return res.status(400).json({
            success: false,
            error: 'q is too long',
            code: 'TMDB_QUERY_INVALID',
          });
        }
        // Reject obvious media-ID shapes — clients should use stream search directly
        if (/^tt\d+/i.test(q) || /^[a-zA-Z][a-zA-Z0-9]*:/.test(q)) {
          return res.status(400).json({
            success: false,
            error: 'Use media ID search for IMDb or prefixed ids',
            code: 'TMDB_QUERY_IS_MEDIA_ID',
          });
        }

        const allowTmdbFallback =
          req.query.allowTmdbFallback === '1' || req.query.allowTmdbFallback === 'true';

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const keyResult = loadDecryptedKey(userDb);
        if (!keyResult.ok) {
          return res.status(keyResult.status).json(keyResult.body);
        }

        try {
          const results = await searchTmdbTitles(keyResult.apiKey, q, { allowTmdbFallback });
          res.json({ success: true, results });
        } catch (error) {
          return mapTmdbError(error, res);
        }
      } catch (error) {
        logger.error('Error searching TMDB titles', error, {
          endpoint: '/api/tmdb/search',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // GET /api/tmdb/find?imdbId= | tmdbId=&mediaType=&allowTmdbFallback=
  app.get(
    '/api/tmdb/find',
    backend.requireRegisteredUser,
    userRateLimiter,
    tmdbFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const imdbRaw = typeof req.query.imdbId === 'string' ? req.query.imdbId.trim() : '';
        const tmdbRaw = typeof req.query.tmdbId === 'string' ? req.query.tmdbId.trim() : '';
        const mediaTypeRaw =
          typeof req.query.mediaType === 'string' ? req.query.mediaType.trim().toLowerCase() : '';
        const allowTmdbFallback =
          req.query.allowTmdbFallback === '1' || req.query.allowTmdbFallback === 'true';

        const hasImdb = Boolean(imdbRaw);
        const hasTmdb = Boolean(tmdbRaw);
        if (hasImdb === hasTmdb) {
          return res.status(400).json({
            success: false,
            error: 'Provide exactly one of imdbId or tmdbId',
            code: 'TMDB_FIND_PARAMS_INVALID',
          });
        }

        if (hasImdb && !/^tt\d+$/i.test(imdbRaw)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid IMDb id',
            code: 'TMDB_FIND_INVALID',
          });
        }
        if (hasTmdb && !/^\d+$/.test(tmdbRaw)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid TMDB id',
            code: 'TMDB_FIND_INVALID',
          });
        }
        if (mediaTypeRaw && mediaTypeRaw !== 'movie' && mediaTypeRaw !== 'tv') {
          return res.status(400).json({
            success: false,
            error: 'mediaType must be movie or tv',
            code: 'TMDB_FIND_PARAMS_INVALID',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const keyResult = loadDecryptedKey(userDb);
        if (!keyResult.ok) {
          return res.status(keyResult.status).json(keyResult.body);
        }

        try {
          const result = hasImdb
            ? await findTmdbByImdbId(keyResult.apiKey, imdbRaw, { allowTmdbFallback })
            : await findTmdbByTmdbId(keyResult.apiKey, tmdbRaw, {
                allowTmdbFallback,
                mediaType: mediaTypeRaw || undefined,
              });

          if (!result) {
            return res.status(404).json({
              success: false,
              error: 'No TMDB match found',
              code: 'TMDB_FIND_NOT_FOUND',
            });
          }

          res.json({ success: true, result });
        } catch (error) {
          return mapTmdbError(error, res);
        }
      } catch (error) {
        logger.error('Error finding TMDB title', error, {
          endpoint: '/api/tmdb/find',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // GET /api/tmdb/tv/:id
  app.get(
    '/api/tmdb/tv/:id',
    backend.requireRegisteredUser,
    userRateLimiter,
    tmdbFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const tvId = String(req.params.id || '').trim();
        if (!/^\d+$/.test(tvId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid TV id',
            code: 'TMDB_TV_ID_INVALID',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const keyResult = loadDecryptedKey(userDb);
        if (!keyResult.ok) {
          return res.status(keyResult.status).json(keyResult.body);
        }

        try {
          const details = await fetchTvDetails(keyResult.apiKey, tvId);
          res.json({ success: true, ...details });
        } catch (error) {
          return mapTmdbError(error, res);
        }
      } catch (error) {
        logger.error('Error fetching TMDB TV details', error, {
          endpoint: '/api/tmdb/tv/:id',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );

  // GET /api/tmdb/tv/:id/season/:seasonNumber
  app.get(
    '/api/tmdb/tv/:id/season/:seasonNumber',
    backend.requireRegisteredUser,
    userRateLimiter,
    tmdbFetchLimiter,
    async (req, res) => {
      try {
        const authId = req.validatedAuthId;
        if (!backend.userDatabaseManager) return serviceUnavailable(res);

        const tvId = String(req.params.id || '').trim();
        const seasonRaw = String(req.params.seasonNumber || '').trim();
        if (!/^\d+$/.test(tvId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid TV id',
            code: 'TMDB_TV_ID_INVALID',
          });
        }
        if (!/^\d+$/.test(seasonRaw) || parseInt(seasonRaw, 10) < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid season number',
            code: 'TMDB_SEASON_INVALID',
          });
        }

        const userDb = await backend.userDatabaseManager.getUserDatabase(authId);
        const keyResult = loadDecryptedKey(userDb);
        if (!keyResult.ok) {
          return res.status(keyResult.status).json(keyResult.body);
        }

        try {
          const season = await fetchTvSeason(keyResult.apiKey, tvId, seasonRaw);
          res.json({ success: true, ...season });
        } catch (error) {
          return mapTmdbError(error, res);
        }
      } catch (error) {
        logger.error('Error fetching TMDB TV season', error, {
          endpoint: '/api/tmdb/tv/:id/season/:seasonNumber',
          method: 'GET',
          authId: req.validatedAuthId,
        });
        res.status(500).json(serverErrorPayload(error));
      } finally {
        releaseUserDb(backend, req.validatedAuthId);
      }
    }
  );
}
