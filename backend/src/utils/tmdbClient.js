import { safeExternalFetch } from './safeExternalFetch.js';
import { Semaphore } from './semaphore.js';

const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const TMDB_TIMEOUT_MS = 8_000;
const SEARCH_ENRICH_LIMIT = 10;
const TMDB_FETCH_ATTEMPTS = 5;
const TMDB_RETRY_BASE_MS = 250;
/**
 * Bun's HTTPS client drops concurrent sockets to api.themoviedb.org (CloudFront)
 * with "socket connection was closed unexpectedly". Cap in-flight TMDB fetches.
 */
const TMDB_FETCH_CONCURRENCY = 2;
const tmdbFetchGate = new Semaphore(TMDB_FETCH_CONCURRENCY);

const NETWORK_ERROR_CODES = new Set([
  'NETWORK_ERROR',
  'TIMEOUT',
  'DNS_FAILED',
  'SSRF_BLOCKED',
  'INVALID_URL',
]);

/**
 * TMDB v4 Read Access Tokens are JWTs; v3 API keys are opaque strings.
 * @param {string} apiKey
 * @returns {boolean}
 */
export function isTmdbV4ReadToken(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith('eyJ');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableTmdbError(error) {
  const code = error?.code;
  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT' || code === 'DNS_FAILED') return true;
  const msg = String(error?.message || '');
  return /socket connection was closed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR/i.test(msg);
}

/**
 * User-facing message — never leak Bun/Node fetch internals.
 */
export function formatTmdbNetworkError(error) {
  const code = error?.code;
  if (code === 'TIMEOUT') return 'TMDB request timed out. Please try again.';
  if (code === 'DNS_FAILED') return 'Could not resolve api.themoviedb.org. Check DNS/network.';
  if (code === 'SSRF_BLOCKED' || code === 'INVALID_URL') {
    return 'Blocked outbound request to TMDB.';
  }
  return 'Could not reach TMDB. Please try again in a moment.';
}

/**
 * Map a thrown TMDB client error to an HTTP status + JSON body for API routes.
 * @param {Error & { status?: number, code?: string }} error
 * @returns {{ status: number, body: { success: false, error: string, code: string } }}
 */
export function tmdbErrorPayload(error) {
  const code = error?.code || 'TMDB_UPSTREAM_ERROR';
  const status = typeof error?.status === 'number' ? error.status : code === 'TIMEOUT' ? 504 : 502;
  const message = NETWORK_ERROR_CODES.has(code)
    ? formatTmdbNetworkError(error)
    : error?.message || 'TMDB request failed';
  return {
    status,
    body: {
      success: false,
      error: message,
      code,
    },
  };
}

/**
 * @param {string} path - Path after /3 (e.g. /search/multi)
 * @param {string} apiKey - TMDB v3 API key or v4 read access token
 * @param {Record<string, string>} [query]
 */
export async function tmdbFetch(path, apiKey, query = {}) {
  const url = new URL(`${TMDB_API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  const headers = {};
  if (isTmdbV4ReadToken(apiKey)) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    url.searchParams.set('api_key', apiKey);
  }
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  let lastError;
  for (let attempt = 1; attempt <= TMDB_FETCH_ATTEMPTS; attempt++) {
    await tmdbFetchGate.acquire();
    try {
      return await safeExternalFetch(url.toString(), {
        timeoutMs: TMDB_TIMEOUT_MS,
        headers,
      });
    } catch (error) {
      lastError = error;
      if (attempt >= TMDB_FETCH_ATTEMPTS || !isRetryableTmdbError(error)) {
        throw error;
      }
    } finally {
      tmdbFetchGate.release();
    }
    await sleep(TMDB_RETRY_BASE_MS * attempt);
  }
  throw lastError;
}

/**
 * Validate a TMDB API key (v3 query key or v4 read token) via /configuration.
 * @returns {{ ok: true } | { ok: false, status: number, code: string, error: string }}
 */
export async function validateTmdbApiKey(apiKey) {
  try {
    const response = await tmdbFetch('/configuration', apiKey);
    if (response.ok) {
      return { ok: true };
    }
    if (response.status === 401) {
      return {
        ok: false,
        status: 401,
        code: 'TMDB_INVALID_KEY',
        error: 'Invalid TMDB API key',
      };
    }
    return {
      ok: false,
      status: 502,
      code: 'TMDB_UPSTREAM_ERROR',
      error: `TMDB validation failed with HTTP ${response.status}`,
    };
  } catch (error) {
    const code = error.code || 'NETWORK_ERROR';
    if (code === 'TIMEOUT') {
      return { ok: false, status: 504, code, error: formatTmdbNetworkError(error) };
    }
    return {
      ok: false,
      status: 502,
      code,
      error: formatTmdbNetworkError(error),
    };
  }
}

/**
 * Normalize IMDb id from TMDB external_ids payload.
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
export function normalizeImdbId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (/^tt\d+$/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Build stream id preferred for Stremio: IMDb when present, else tmdb: fallback.
 * @param {{ mediaType: 'movie'|'tv', tmdbId: number, imdbId: string|null }} item
 * @param {boolean} allowTmdbFallback
 * @returns {string|null} null when neither IMDb nor allowed tmdb fallback
 */
export function buildStreamId({ mediaType, tmdbId, imdbId }, allowTmdbFallback) {
  if (imdbId) return imdbId;
  if (allowTmdbFallback && tmdbId != null) {
    return `tmdb:${tmdbId}`;
  }
  return null;
}

/**
 * Map a raw TMDB multi-search hit + external ids into a suggestion DTO.
 */
export function mapSearchHit(hit, imdbId, allowTmdbFallback) {
  const mediaType = hit.media_type === 'tv' ? 'tv' : hit.media_type === 'movie' ? 'movie' : null;
  if (!mediaType || hit.id == null) return null;

  const title =
    mediaType === 'movie'
      ? hit.title || hit.original_title || ''
      : hit.name || hit.original_name || '';
  if (!title) return null;

  const dateStr = mediaType === 'movie' ? hit.release_date : hit.first_air_date;
  const year = dateStr && /^\d{4}/.test(dateStr) ? dateStr.slice(0, 4) : null;

  const streamId = buildStreamId(
    { mediaType, tmdbId: hit.id, imdbId: normalizeImdbId(imdbId) },
    allowTmdbFallback
  );
  if (!streamId) return null;

  return {
    tmdbId: hit.id,
    mediaType,
    title,
    year,
    posterPath: hit.poster_path || null,
    imdbId: normalizeImdbId(imdbId),
    streamId,
  };
}

/**
 * Search TMDB multi endpoint and enrich with external_ids.
 * @param {string} apiKey
 * @param {string} query
 * @param {{ allowTmdbFallback?: boolean }} [options]
 */
export async function searchTmdbTitles(apiKey, query, options = {}) {
  const allowTmdbFallback = options.allowTmdbFallback === true;
  const response = await tmdbFetch('/search/multi', apiKey, {
    query,
    include_adult: 'false',
    page: '1',
  });

  if (!response.ok) {
    const err = new Error(`TMDB search failed with HTTP ${response.status}`);
    err.code = response.status === 401 ? 'TMDB_INVALID_KEY' : 'TMDB_UPSTREAM_ERROR';
    err.status = response.status === 401 ? 401 : 502;
    err.httpStatus = response.status;
    throw err;
  }

  const results = Array.isArray(response.json?.results) ? response.json.results : [];
  const candidates = results
    .filter((hit) => hit && (hit.media_type === 'movie' || hit.media_type === 'tv'))
    .slice(0, SEARCH_ENRICH_LIMIT);

  const enriched = await Promise.all(
    candidates.map(async (hit) => {
      try {
        const ext = await tmdbFetch(`/${hit.media_type}/${hit.id}/external_ids`, apiKey);
        const imdbId = ext.ok ? ext.json?.imdb_id : null;
        return mapSearchHit(hit, imdbId, allowTmdbFallback);
      } catch {
        // If external_ids fails, still try without imdb when tmdb fallback allowed
        return mapSearchHit(hit, null, allowTmdbFallback);
      }
    })
  );

  return enriched.filter(Boolean);
}

/**
 * Map a TMDB TV season summary (from /tv/{id}). Returns null for specials / invalid.
 * @param {object} s
 * @returns {object|null}
 */
export function mapTvSeasonSummary(s) {
  if (!s || s.season_number == null || s.season_number <= 0) return null;
  return {
    seasonNumber: s.season_number,
    name: s.name || `Season ${s.season_number}`,
    episodeCount: typeof s.episode_count === 'number' ? s.episode_count : 0,
    posterPath: s.poster_path || null,
    airDate: s.air_date || null,
  };
}

/**
 * Map a TMDB episode from /tv/{id}/season/{n}.
 * @param {object} ep
 * @returns {object|null}
 */
export function mapTvSeasonEpisode(ep) {
  if (!ep || ep.episode_number == null || ep.episode_number < 1) return null;
  return {
    episodeNumber: ep.episode_number,
    name: ep.name || `Episode ${ep.episode_number}`,
    stillPath: ep.still_path || null,
    airDate: ep.air_date || null,
  };
}

/**
 * Fetch TV show seasons for episode picker.
 * @param {string} apiKey
 * @param {number|string} tvId
 */
export async function fetchTvDetails(apiKey, tvId) {
  const response = await tmdbFetch(`/tv/${tvId}`, apiKey);
  if (!response.ok) {
    const err = new Error(`TMDB TV details failed with HTTP ${response.status}`);
    err.code = response.status === 401 ? 'TMDB_INVALID_KEY' : 'TMDB_UPSTREAM_ERROR';
    err.status = response.status === 401 ? 401 : 502;
    err.httpStatus = response.status;
    throw err;
  }

  const data = response.json || {};
  const seasons = Array.isArray(data.seasons)
    ? data.seasons.map(mapTvSeasonSummary).filter(Boolean)
    : [];

  return {
    tmdbId: data.id,
    name: data.name || data.original_name || '',
    seasons,
  };
}

/**
 * Fetch episodes for a TV season.
 * @param {string} apiKey
 * @param {number|string} tvId
 * @param {number|string} seasonNumber
 */
export async function fetchTvSeason(apiKey, tvId, seasonNumber) {
  const n = typeof seasonNumber === 'number' ? seasonNumber : parseInt(String(seasonNumber), 10);
  if (!Number.isInteger(n) || n < 1) {
    const err = new Error('Invalid season number');
    err.code = 'TMDB_SEASON_INVALID';
    err.status = 400;
    throw err;
  }

  const response = await tmdbFetch(`/tv/${tvId}/season/${n}`, apiKey);
  if (!response.ok) {
    const err = new Error(`TMDB TV season failed with HTTP ${response.status}`);
    err.code = response.status === 401 ? 'TMDB_INVALID_KEY' : 'TMDB_UPSTREAM_ERROR';
    err.status = response.status === 401 ? 401 : 502;
    err.httpStatus = response.status;
    throw err;
  }

  const data = response.json || {};
  const episodes = Array.isArray(data.episodes)
    ? data.episodes.map(mapTvSeasonEpisode).filter(Boolean)
    : [];

  return {
    seasonNumber: data.season_number != null ? data.season_number : n,
    name: data.name || `Season ${n}`,
    episodes,
  };
}

function throwTmdbHttpError(label, status) {
  const err = new Error(`${label} failed with HTTP ${status}`);
  err.code = status === 401 ? 'TMDB_INVALID_KEY' : 'TMDB_UPSTREAM_ERROR';
  err.status = status === 401 ? 401 : 502;
  err.httpStatus = status;
  throw err;
}

/**
 * Find a title by IMDb id via TMDB /find.
 * @param {string} apiKey
 * @param {string} imdbId
 * @param {{ allowTmdbFallback?: boolean }} [options]
 * @returns {Promise<object|null>}
 */
export async function findTmdbByImdbId(apiKey, imdbId, options = {}) {
  const allowTmdbFallback = options.allowTmdbFallback === true;
  const id = normalizeImdbId(imdbId);
  if (!id) {
    const err = new Error('Invalid IMDb id');
    err.code = 'TMDB_FIND_INVALID';
    err.status = 400;
    throw err;
  }

  const response = await tmdbFetch(`/find/${id}`, apiKey, { external_source: 'imdb_id' });
  if (!response.ok) {
    throwTmdbHttpError('TMDB find', response.status);
  }

  const movie = Array.isArray(response.json?.movie_results) ? response.json.movie_results[0] : null;
  const tv = Array.isArray(response.json?.tv_results) ? response.json.tv_results[0] : null;
  const hit = movie ? { ...movie, media_type: 'movie' } : tv ? { ...tv, media_type: 'tv' } : null;
  if (!hit) return null;
  return mapSearchHit(hit, id, allowTmdbFallback);
}

/**
 * Find a title by TMDB id (movie and/or tv detail).
 * @param {string} apiKey
 * @param {number|string} tmdbId
 * @param {{ allowTmdbFallback?: boolean, mediaType?: 'movie'|'tv' }} [options]
 * @returns {Promise<object|null>}
 */
export async function findTmdbByTmdbId(apiKey, tmdbId, options = {}) {
  const allowTmdbFallback = options.allowTmdbFallback === true;
  const id = String(tmdbId || '').trim();
  if (!/^\d+$/.test(id)) {
    const err = new Error('Invalid TMDB id');
    err.code = 'TMDB_FIND_INVALID';
    err.status = 400;
    throw err;
  }

  const preferred =
    options.mediaType === 'tv' ? 'tv' : options.mediaType === 'movie' ? 'movie' : null;
  const order =
    preferred === 'tv'
      ? ['tv', 'movie']
      : preferred === 'movie'
        ? ['movie', 'tv']
        : ['movie', 'tv'];

  for (const media_type of order) {
    const detail = await tmdbFetch(`/${media_type}/${id}`, apiKey);
    if (!detail.ok) {
      // Invalid/revoked key must surface as 401, not a silent miss → 404.
      if (detail.status === 401) {
        throwTmdbHttpError('TMDB find', 401);
      }
      continue;
    }
    let imdbId = null;
    try {
      const ext = await tmdbFetch(`/${media_type}/${id}/external_ids`, apiKey);
      if (ext.status === 401) {
        throwTmdbHttpError('TMDB find', 401);
      }
      imdbId = ext.ok ? ext.json?.imdb_id : null;
    } catch (error) {
      if (error?.code === 'TMDB_INVALID_KEY' || error?.status === 401) throw error;
      imdbId = null;
    }
    const hit = { ...detail.json, media_type, id: detail.json?.id ?? Number(id) };
    const mapped = mapSearchHit(hit, imdbId, allowTmdbFallback);
    if (mapped) return mapped;
  }
  return null;
}

export { SEARCH_ENRICH_LIMIT, TMDB_API_BASE, TMDB_FETCH_CONCURRENCY };
