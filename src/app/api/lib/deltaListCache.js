/**
 * Server-only: in-memory cache and delta computation for torrents/usenet/webdl list proxies.
 * Keyed by apiKey + type; TTL 30 minutes to avoid unbounded growth.
 * List data is gzip-compressed in memory to reduce RAM usage.
 */

const zlib = require('zlib');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const GZIP_LEVEL = 6; // balance of speed vs ratio

/** @type {Map<string, { compressedData: Buffer, cursor: string, lastAccess: number }>} */
const cache = new Map();

function cacheKey(apiKey, type) {
  return `${apiKey}:${type}`;
}

function compressData(data) {
  return zlib.gzipSync(JSON.stringify(data), { level: GZIP_LEVEL });
}

function decompressData(buffer) {
  return JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
}

function isItemChanged(prev, curr) {
  if (prev.updated_at != null && curr.updated_at != null) {
    return prev.updated_at !== curr.updated_at;
  }
  return JSON.stringify(prev) !== JSON.stringify(curr);
}

/**
 * Compute delta between previous and current list. Item identity by id.
 * @param {Array<object>} prevList
 * @param {Array<object>} currList
 * @returns {{ data: Array<object>, removed: number[] }}
 */
function computeDelta(prevList, currList) {
  const prevIds = new Set((prevList || []).map((i) => i.id));
  const currIds = new Set((currList || []).map((i) => i.id));
  const prevById = new Map((prevList || []).map((i) => [i.id, i]));

  const removed = [...prevIds].filter((id) => !currIds.has(id));
  const data = [];

  for (const item of currList || []) {
    const id = item.id;
    if (!prevIds.has(id)) {
      data.push(item);
    } else {
      const prev = prevById.get(id);
      if (prev && isItemChanged(prev, item)) {
        data.push(item);
      }
    }
  }

  return { data, removed };
}

/**
 * @param {string} apiKey
 * @param {string} type
 * @returns {{ data: Array<object>, cursor: string } | null}
 */
function getCached(apiKey, type) {
  const key = cacheKey(apiKey, type);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.lastAccess > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  entry.lastAccess = Date.now();
  const data = decompressData(entry.compressedData);
  return { data, cursor: entry.cursor };
}

/**
 * @param {string} apiKey
 * @param {string} type
 * @param {Array<object>} data
 * @returns {string} new cursor
 */
function setCached(apiKey, type, data) {
  const key = cacheKey(apiKey, type);
  const now = Date.now();
  const cursor = now.toString(36) + Math.random().toString(36).slice(2, 8);
  const list = Array.isArray(data) ? data : [];
  cache.set(key, {
    compressedData: compressData(list),
    cursor,
    lastAccess: now,
  });
  return cursor;
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.lastAccess > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

// Evict expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(evictExpired, 5 * 60 * 1000);
}

module.exports = {
  computeDelta,
  getCached,
  setCached,
};
