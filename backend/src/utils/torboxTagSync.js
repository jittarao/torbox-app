import ApiClient from '../api/ApiClient.js';
import { createHash } from 'node:crypto';
import logger from './logger.js';
import { parseTorboxRateLimitHeaders } from '../config/torboxRateLimitHeaders.js';

const TYPES = [
  { list: '/api/torrents/mylist', edit: '/api/torrents/edittorrent', idField: 'torrent_id' },
  {
    list: '/api/usenet/mylist',
    edit: '/api/usenet/editusenetdownload',
    idField: 'usenet_download_id',
  },
  { list: '/api/webdl/mylist', edit: '/api/webdl/editwebdownload', idField: 'webdl_id' },
];
const queues = new Map();

export function tagNames(tags) {
  const names = new Map();
  for (const tag of Array.isArray(tags) ? tags : []) {
    const value = typeof tag === 'string' ? tag : tag?.name;
    if (typeof value !== 'string' || !value.trim()) continue;
    const name = value.trim();
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()];
}

function checkResponse(response) {
  if (response.data?.success === false) {
    const error = new Error('TorBox rejected the tag request');
    error.code = response.data.error;
    throw error;
  }
  return response.data?.data;
}

export async function editTags(client, item, names) {
  const type = item._tagSyncType;
  const body = { [type.idField]: item.id, tags: tagNames(names) };
  // Preserve the current values. Missing fields must not become destructive defaults.
  if (item.alternative_hashes != null || item.alternativeHashes != null) {
    body.alternative_hashes = item.alternative_hashes ?? item.alternativeHashes;
  }
  if (item.airlocked != null) {
    body.airlocked = item.airlocked === true || item.airlocked === 1 || item.airlocked === 'true';
  }
  if (typeof item.name === 'string' && item.name.trim().length >= 2) body.name = item.name;
  await client.handleApiCall(
    async () => {
      checkResponse(await client.client.put(type.edit, body, { timeout: 15_000 }));
    },
    { endpoint: type.edit, operation: 'updating tags' }
  );
}

export async function pushDownloadTags(client, id, names, removedNames = []) {
  // Local mappings predate asset types, so probe only this ID across the three types.
  // A queued/archived item absent from mylist stays local and can be retried later.
  for (const type of TYPES) {
    const data = await client.handleApiCall(
      async () => {
        try {
          return checkResponse(
            await client.client.get(type.list, {
              params: { id, bypass_cache: true },
              timeout: 20_000,
            })
          );
        } catch (error) {
          if (error.response?.status === 404 || error.code === 'DOWNLOAD_NOT_FOUND') return null;
          throw error;
        }
      },
      { endpoint: type.list, operation: 'fetching download for tag edit', semaphore: 'fetch' }
    );
    const items = Array.isArray(data) ? data : data ? [data] : [];
    for (const item of items) {
      if (String(item.id) !== String(id)) continue;
      const removed = new Set(removedNames.map((name) => name.toLowerCase()));
      const next = tagNames([
        ...tagNames(item.tags).filter((name) => !removed.has(name.toLowerCase())),
        ...names,
      ]);
      if (JSON.stringify(tagNames(item.tags)) !== JSON.stringify(next)) {
        await editTags(client, { ...item, _tagSyncType: type }, next);
      }
      return;
    }
  }
  throw new Error('Download unavailable for tag editing; local tags retained');
}

export function tagSyncClient(req) {
  const key = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return key ? new ApiClient(key, { authId: req.validatedAuthId }) : null;
}

export function captureTagNames(db, ids) {
  const select = db.prepare(`SELECT t.name FROM download_tags dt
    JOIN tags t ON t.id = dt.tag_id WHERE dt.download_id = ? ORDER BY t.name`);
  return new Map(ids.map((id) => [String(id), select.all(String(id)).map((row) => row.name)]));
}

// Capture local state synchronously after the local transaction. No background task
// holds a database handle. The durable ID set includes removals (even the last tag),
// so explicit Sync now can retry failures after a restart or a queued item starts.
export function queueTagPush(db, client, downloadIds, previousNames = new Map()) {
  if (!client?.apiKey) return Promise.resolve();
  const key = createHash('sha256').update(client.apiKey).digest('hex');
  let queue = queues.get(key);
  if (!queue) {
    queue = { pending: new Map(), promise: null, failed: 0, completed: 0 };
    queues.set(key, queue);
  }
  const currentNames = captureTagNames(db, downloadIds);
  const selectPending = db.prepare(
    'SELECT removed_names FROM torbox_tag_sync_pending WHERE download_id = ?'
  );
  const remember = db.prepare(`INSERT INTO torbox_tag_sync_pending (download_id, removed_names)
    VALUES (?, ?) ON CONFLICT(download_id) DO UPDATE SET removed_names = excluded.removed_names`);
  for (const [id, names] of currentNames) {
    const local = new Set(names.map((name) => name.toLowerCase()));
    const removedNames = tagNames([
      ...JSON.parse(selectPending.get(id)?.removed_names || '[]'),
      ...(previousNames.get(id) || []),
    ]).filter((name) => !local.has(name.toLowerCase()));
    remember.run(id, JSON.stringify(removedNames));
    queue.pending.set(id, { names, removedNames });
  }
  if (!queue.promise) {
    queue.failed = 0;
    queue.completed = 0;
    queue.promise = Promise.resolve().then(async () => {
      try {
        while (queue.pending.size) {
          const [id, { names, removedNames }] = queue.pending.entries().next().value;
          queue.pending.delete(id);
          try {
            if (Date.now() < (queue.retryAt || 0)) {
              queue.failed += queue.pending.size + 1;
              queue.pending.clear();
              break;
            }
            await pushDownloadTags(client, id, names, removedNames);
            queue.completed++;
          } catch (error) {
            queue.failed++;
            logger.warn('TorBox tag push failed; local tags retained. Use Sync now to retry.', {
              authId: client.authId,
              downloadId: id,
              code: error.code,
              status: error.response?.status,
            });
            if (error.response?.status === 429) {
              const headers = parseTorboxRateLimitHeaders(error.response.headers);
              queue.retryAt = Math.max(
                Date.now() + 120_000,
                Date.now() + (headers.retryAfterSeconds || 0) * 1000,
                headers.resetAtMs || 0
              );
            }
            if (error.response?.status === 429 || error.isConnectionError) {
              queue.failed += queue.pending.size;
              queue.pending.clear();
            }
          }
        }
      } finally {
        queue.promise = null;
      }
    });
  }
  return queue.promise;
}

export function syncTorboxTags(req, db) {
  const ids = db
    .prepare(
      `SELECT download_id FROM download_tags
    UNION SELECT download_id FROM torbox_tag_sync_pending`
    )
    .all()
    .map((row) => row.download_id);
  return queueTagPush(db, tagSyncClient(req), ids);
}

export function tagSyncStatus(req) {
  const client = tagSyncClient(req);
  const key = client && createHash('sha256').update(client.apiKey).digest('hex');
  const queue = queues.get(key);
  return {
    running: Boolean(queue?.promise),
    completed: queue?.completed || 0,
    failed: queue?.failed || 0,
  };
}
