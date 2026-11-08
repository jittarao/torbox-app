import ApiClient from '../api/ApiClient.js';
import { fetchAllMyListPages } from '../api/mylistPagination.js';
import { parseTorboxRateLimitHeaders } from '../config/torboxRateLimitHeaders.js';
import logger from './logger.js';

const TYPES = [
  { list: '/api/torrents/mylist', edit: '/api/torrents/edittorrent', idField: 'torrent_id' },
  { list: '/api/usenet/mylist', edit: '/api/usenet/editusenetdownload', idField: 'usenet_download_id' },
  { list: '/api/webdl/mylist', edit: '/api/webdl/editwebdownload', idField: 'webdl_id' },
];

const recentSyncs = new Map();
const SYNC_INTERVAL_MS = 60_000;
const MANUAL_SYNC_MIN_INTERVAL_MS = 10_000;
const RATE_LIMIT_FALLBACK_MS = 120_000;
const ERROR_RETRY_MS = 60_000;

export function tagSyncRetryDelayMs(error, now = Date.now()) {
  if (error?.response?.status !== 429) return ERROR_RETRY_MS;
  const headers = parseTorboxRateLimitHeaders(error.response.headers, now);
  const retryAfterMs = headers.retryAfterSeconds ? headers.retryAfterSeconds * 1000 : 0;
  const resetMs = headers.resetAtMs ? headers.resetAtMs - now : 0;
  return Math.max(RATE_LIMIT_FALLBACK_MS, retryAfterMs, resetMs);
}

function rememberSyncResult(authId, delayMs, { rateLimited = false, canForce = true } = {}) {
  recentSyncs.set(authId, {
    nextAt: Date.now() + delayMs,
    promise: Promise.resolve(),
    rateLimited,
    canForce,
    pending: false,
    attemptedAt: Date.now(),
  });
}

export function shouldSkipTagSync(previous, force, now = Date.now()) {
  if (!previous) return false;
  if (previous.pending) return true;
  if (now >= previous.nextAt) return false;
  if (!force || !previous.canForce) return true;
  return now - previous.attemptedAt < MANUAL_SYNC_MIN_INTERVAL_MS;
}

function apiKeyFromRequest(req) {
  return req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '') || null;
}

function tagNames(tags) {
  if (!Array.isArray(tags)) return [];
  const names = new Map();
  for (const value of tags) {
    if (typeof value !== 'string') continue;
    const name = value.trim();
    if (name && !names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}

export async function listDownloads(client) {
  const downloads = [];
  const tagListClient = {
    get: async (...args) => {
      const response = await client.client.get(...args);
      if (response.data?.success === false) {
        throw new Error(response.data.detail || response.data.error || 'TorBox list request failed');
      }
      return response;
    },
  };
  for (const type of TYPES) {
    let items;
    try {
      ({ items } = await fetchAllMyListPages({
        client: tagListClient,
        endpoint: type.list,
        bypassCache: true,
        timeout: 20_000,
      }));
    } catch (error) {
      error.tagSyncEndpoint = type.list;
      throw error;
    }
    for (const item of items) downloads.push({ ...item, _tagSyncType: type });
  }
  return downloads;
}

export async function editTags(client, item, names) {
  const type = item._tagSyncType;
  const id = item.id;
  try {
    const body = {
      [type.idField]: id,
      tags: names,
      alternative_hashes: item.alternative_hashes || [],
      airlocked: item.airlocked === true,
    };
    // TorBox's own WebDL UI omits name for tag-only edits. Sending an empty or
    // one-character name fails validation and inventing one changes T3 paths.
    if (typeof item.name === 'string' && item.name.trim().length >= 2) {
      body.name = item.name;
    }
    const response = await client.client.put(type.edit, body);
    if (response.data?.success === false) {
      throw new Error(response.data.detail || response.data.error || 'TorBox refused the tag update');
    }
  } catch (error) {
    error.tagSyncEndpoint = type.edit;
    error.downloadId = id;
    throw error;
  }
  item.tags = names;
}

function logTagSyncFailure(message, authId, error) {
  const upstreamCode = error?.response?.data?.error;
  const code = error.code || upstreamCode;
  logger.warn(message, {
    authId,
    endpoint: error.tagSyncEndpoint || 'local',
    status: error?.response?.status,
    code: typeof code === 'string' && /^[A-Z0-9_]+$/.test(code)
      ? code
      : undefined,
    downloadId: error.downloadId,
    error: error.tagSyncEndpoint && !error.response
      ? 'TorBox rejected the tag request'
      : error.message,
  });
}

export function importAssignments(db, downloads, initialized, options = {}) {
  const { skipIds = new Set(), pendingUpdates = [], pendingDeletes = [] } = options;
  const findTag = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?)');
  const insertTag = db.prepare('INSERT INTO tags (name, remote_seen) VALUES (?, 1)');
  const markSeen = db.prepare('UPDATE tags SET remote_seen = 1 WHERE id = ?');
  const clearItem = db.prepare('DELETE FROM download_tags WHERE download_id = ?');
  const insertAssignment = db.prepare('INSERT OR IGNORE INTO download_tags (tag_id, download_id) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const item of downloads) {
      if (item.id == null) continue;
      if (skipIds.has(String(item.id))) continue;
      clearItem.run(String(item.id));
      for (const name of tagNames(item.tags)) {
        const tagId = findTag.get(name)?.id || insertTag.run(name).lastInsertRowid;
        markSeen.run(tagId);
        insertAssignment.run(tagId, String(item.id));
      }
    }
    db.prepare(`DELETE FROM tags WHERE remote_seen = 1 AND NOT EXISTS (
      SELECT 1 FROM download_tags WHERE tag_id = tags.id
    )`).run();
    for (const row of pendingUpdates) {
      db.prepare(`INSERT INTO torbox_tag_sync_pending (download_id, last_name)
        VALUES (?, ?) ON CONFLICT(download_id) DO UPDATE SET last_name = excluded.last_name`).run(
        row.downloadId,
        row.lastName
      );
    }
    for (const id of pendingDeletes) {
      db.prepare('DELETE FROM torbox_tag_sync_pending WHERE download_id = ?').run(id);
    }
    if (!initialized) db.prepare('INSERT INTO torbox_tag_sync_state (id) VALUES (1)').run();
  });
  transaction();
}

async function syncNow(db, apiKey) {
  const client = new ApiClient(apiKey);
  const downloads = await listDownloads(client);
  const initialized = Boolean(db.prepare('SELECT id FROM torbox_tag_sync_state WHERE id = 1').get());

  const pending = new Map(db.prepare('SELECT download_id, last_name FROM torbox_tag_sync_pending')
    .all().map((row) => [row.download_id, row.last_name]));
  const skipIds = new Set();
  const pendingUpdates = [];
  const pendingDeletes = [];

  // Preserve existing TBM assignments once. Downloads TorBox cannot edit are
  // recorded separately so they do not block sync for the rest of the library.
  if (!initialized || pending.size > 0) {
    const local = db.prepare(`
      SELECT dt.download_id, t.name FROM download_tags dt
      JOIN tags t ON t.id = dt.tag_id
    `).all();
    const byId = new Map();
    for (const row of local) {
      const names = byId.get(row.download_id) || [];
      names.push(row.name);
      byId.set(row.download_id, names);
    }
    for (const item of downloads) {
      const id = String(item.id);
      const wasPending = pending.has(id);
      if (initialized && !wasPending) continue;
      const merged = tagNames([...tagNames(item.tags), ...(byId.get(String(item.id)) || [])]);
      if (merged.length !== tagNames(item.tags).length) {
        try {
          await editTags(client, item, merged);
        } catch (error) {
          if (error.code !== 'NAME_TOO_SHORT' && error.response?.data?.error !== 'NAME_TOO_SHORT') {
            throw error;
          }
          logger.warn('TorBox tag sync deferred for a download TorBox cannot edit', {
            endpoint: item._tagSyncType.edit,
            downloadId: item.id,
            code: 'NAME_TOO_SHORT',
          });
          skipIds.add(id);
          pendingUpdates.push({ downloadId: id, lastName: item.name });
          continue;
        }
      }
      if (wasPending) pendingDeletes.push(id);
    }
  }

  importAssignments(db, downloads, initialized, { skipIds, pendingUpdates, pendingDeletes });
  return downloads;
}

export function invalidateTorboxTagSync(authId) {
  recentSyncs.delete(authId);
}

export async function syncTorboxTags(req, db) {
  const apiKey = apiKeyFromRequest(req);
  if (!apiKey) return;
  const authId = req.validatedAuthId;
  const previous = recentSyncs.get(authId);
  const force = req.query?.sync === 'true';
  if (shouldSkipTagSync(previous, force)) return previous.promise;

  const state = { nextAt: Infinity, promise: null, rateLimited: false, pending: true, attemptedAt: Date.now() };
  const promise = syncNow(db, apiKey)
    .then(() => {
      if (recentSyncs.get(authId) === state) rememberSyncResult(authId, SYNC_INTERVAL_MS);
    })
    .catch((error) => {
      const rateLimited = error?.response?.status === 429;
      logTagSyncFailure('TorBox tag sync failed; serving saved tags', authId, error);
      if (recentSyncs.get(authId) === state) {
        rememberSyncResult(authId, tagSyncRetryDelayMs(error), { rateLimited, canForce: false });
      }
    });
  state.promise = promise;
  recentSyncs.set(authId, state);
  await promise;
}

export async function changeTorboxTags(req, db, change) {
  const apiKey = apiKeyFromRequest(req);
  if (!apiKey) return;
  const authId = req.validatedAuthId;
  const previous = recentSyncs.get(authId);
  await previous?.promise;
  const current = recentSyncs.get(authId);
  if (current?.rateLimited && Date.now() < current.nextAt) {
    const syncError = new Error('TorBox rate limit reached. Please try again later.');
    syncError.isTorboxTagSyncError = true;
    throw syncError;
  }
  try {
    const client = new ApiClient(apiKey);
    const downloads = await listDownloads(client);
    const targets = change.targets(downloads);
    for (const item of targets) {
      const current = tagNames(item.tags);
      const next = tagNames(change.update(current));
      if (JSON.stringify(current) !== JSON.stringify(next)) await editTags(client, item, next);
    }
    rememberSyncResult(authId, SYNC_INTERVAL_MS);
  } catch (error) {
    logTagSyncFailure('TorBox tag edit failed', authId, error);
    if (error?.response?.status === 429) {
      rememberSyncResult(authId, tagSyncRetryDelayMs(error), { rateLimited: true, canForce: false });
    } else {
      invalidateTorboxTagSync(authId);
    }
    const syncError = new Error(error?.response?.status === 429
      ? 'TorBox rate limit reached. Please try again later.'
      : error?.code === 'NAME_TOO_SHORT' || error?.response?.data?.error === 'NAME_TOO_SHORT'
        ? 'TorBox rejected the tag edit because this download has a short name.'
      : 'Could not update tags on TorBox. Refresh and retry.');
    syncError.isTorboxTagSyncError = true;
    throw syncError;
  }
}
