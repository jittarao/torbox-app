/**
 * Server-only authoritative download list sync cache.
 * Rev-tagged full snapshots: reads serve cached gzip bodies (304 when current);
 * stale reads block on a coalesced TorBox shallow refresh before responding.
 *
 * In-memory per process — single Next.js instance assumed (Docker Compose default).
 * Multi-replica deploys need a shared cache (out of scope).
 */

import zlib from 'zlib';
import { hashApiKey } from '@/app/api/lib/hashApiKey';
import {
  fetchFullDownloadList,
  fetchShallowDownloadList,
  MYLIST_PAGE_LIMIT,
  sortByAddedDesc,
} from '@/app/api/lib/fetchTorboxDownloadList';
import { downloadRowEqual } from '@/utils/downloadListMerge';

const CACHE_TTL_MS = Number(process.env.DOWNLOAD_SYNC_CACHE_TTL_MS) || 30 * 60 * 1000;
const RECONCILE_INTERVAL_MS =
  Number(process.env.DOWNLOAD_SYNC_RECONCILE_INTERVAL_MS) || 5 * 60 * 1000;
const RECONCILE_JITTER_MS = Number(process.env.DOWNLOAD_SYNC_RECONCILE_JITTER_MS) || 60 * 1000;
const SHALLOW_FRESHNESS_MS = Number(process.env.DOWNLOAD_SYNC_SHALLOW_FRESHNESS_MS) || 10 * 1000;
const MUTATION_RECONCILE_DELAY_MS = 30 * 1000;
const RECONCILE_FAILURE_BACKOFF_BASE_MS = 15 * 1000;
const RECONCILE_FAILURE_BACKOFF_MAX_MS = RECONCILE_INTERVAL_MS;
const SHALLOW_FAILURE_BACKOFF_BASE_MS = 5 * 1000;
const SHALLOW_FAILURE_BACKOFF_MAX_MS = SHALLOW_FRESHNESS_MS;
const REV_HISTORY_LIMIT = Number(process.env.DOWNLOAD_SYNC_REV_HISTORY_LIMIT) || 64;
const GZIP_LEVEL = 6;

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const mutationReconcileTimers = new Map();

/**
 * Per-key sync coordination — survives entry replacement via writeEntry.
 * @type {Map<string, SyncKeyState>}
 */
const syncStateByKey = new Map();

/**
 * @typedef {object} SyncKeyState
 * @property {Promise<{ success: boolean } | undefined> | null} fullReconcilePromise
 * @property {Promise<{ success: boolean } | undefined> | null} shallowRefreshPromise
 * @property {number} publishGeneration
 * @property {number | null} lastShallowAttemptAt
 * @property {number} shallowFailureCount
 * @property {Map<number, RevSnapshot>} revHistory
 */

/**
 * @typedef {object} RevSnapshot
 * @property {number} rev
 * @property {Buffer} compressedBody
 * @property {object[] | undefined} [data]
 */

/**
 * @typedef {object} CacheEntry
 * @property {object[]} data
 * @property {Buffer} compressedBody
 * @property {number} rev
 * @property {number} itemCount
 * @property {number} lastAccess
 * @property {number | null} lastShallowPollAt
 * @property {number | null} lastFullReconcileAt
 * @property {'fresh' | 'stale' | 'reconciling' | 'error'} reconcileState
 * @property {string | null} reconcileError
 * @property {boolean} isMultiPage
 * @property {number | null} lastReconcileAttemptAt
 * @property {number} reconcileFailureCount
 */

/**
 * @param {object[]} data
 * @param {number} rev
 */
function buildCompressedBody(data, rev) {
  return zlib.gzipSync(JSON.stringify({ success: true, data, rev }), { level: GZIP_LEVEL });
}

/**
 * @param {object[]} data
 * @param {(number|string)[]} removed
 * @param {number} rev
 */
function buildCompressedDeltaBody(data, removed, rev) {
  return zlib.gzipSync(JSON.stringify({ success: true, delta: true, data, removed, rev }), {
    level: GZIP_LEVEL,
  });
}

function decompressBody(buffer) {
  return JSON.parse(zlib.gunzipSync(buffer).toString('utf8'));
}

/**
 * @param {RevSnapshot | CacheEntry | null | undefined} snapshot
 */
function getSnapshotData(snapshot) {
  if (!snapshot) return [];
  if (Array.isArray(snapshot.data)) return snapshot.data;
  if (!snapshot.compressedBody) return [];
  const parsed = decompressBody(snapshot.compressedBody);
  return Array.isArray(parsed.data) ? parsed.data : [];
}

/**
 * @param {string} key
 * @returns {SyncKeyState}
 */
function getSyncState(key) {
  let state = syncStateByKey.get(key);
  if (!state) {
    state = {
      fullReconcilePromise: null,
      shallowRefreshPromise: null,
      publishGeneration: 0,
      lastShallowAttemptAt: null,
      shallowFailureCount: 0,
      revHistory: new Map(),
    };
    syncStateByKey.set(key, state);
  }
  return state;
}

/**
 * @param {string} authId
 * @param {string} type
 */
export function getCacheKey(authId, type) {
  return `${authId}:${type}`;
}

/**
 * Stable per-user/type jitter so reconcile does not align across users.
 * @param {string} authId
 * @param {string} type
 */
function reconcileJitterMs(authId, type) {
  let hash = 0;
  const key = `${authId}:${type}`;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % RECONCILE_JITTER_MS;
}

function reconcileFailureBackoffMs(failureCount) {
  if (failureCount <= 0) return 0;
  return Math.min(
    RECONCILE_FAILURE_BACKOFF_MAX_MS,
    RECONCILE_FAILURE_BACKOFF_BASE_MS * 2 ** (failureCount - 1)
  );
}

function shallowFailureBackoffMs(failureCount) {
  if (failureCount <= 0) return 0;
  return Math.min(
    SHALLOW_FAILURE_BACKOFF_MAX_MS,
    SHALLOW_FAILURE_BACKOFF_BASE_MS * 2 ** (failureCount - 1)
  );
}

/**
 * Non-queued mylist rows (queued items come from getqueued, not paginated mylist).
 * @param {object[]} list
 */
export function countRegularMylistItems(list) {
  return (list || []).filter((item) => item.status !== 'queued').length;
}

/**
 * True when the regular mylist fits in a single TorBox page (page 0 is complete).
 * @param {object[]} list
 */
export function isSinglePageCatalog(list) {
  return countRegularMylistItems(list) < MYLIST_PAGE_LIMIT;
}

/**
 * Derive multi-page flag from a full reconcile result.
 * @param {object[]} data
 * @param {number} pageCount
 */
export function isMultiPageFromFullReconcile(data, pageCount) {
  return pageCount > 1 || countRegularMylistItems(data) >= MYLIST_PAGE_LIMIT;
}

/**
 * Single-page shallow sync: page 0 + queued is the complete catalog — replacements allowed.
 * @param {object[]} partial
 */
export function applySinglePageShallowMerge(partial) {
  return sortByAddedDesc(partial || []);
}

/**
 * Patch authoritative cache with partial page-0 data. Never removes IDs (multi-page catalogs).
 * @param {object[]} authoritative
 * @param {object[]} partial
 */
export function applyShallowPatch(authoritative, partial) {
  const byId = new Map((authoritative || []).map((item) => [item.id, item]));
  for (const item of partial || []) {
    byId.set(item.id, item);
  }
  return sortByAddedDesc([...byId.values()]);
}

/**
 * @param {object[]} prevList
 * @param {object[]} nextList
 */
function listsEqual(prevList, nextList) {
  if ((prevList || []).length !== (nextList || []).length) return false;
  const nextById = new Map((nextList || []).map((item) => [item.id, item]));
  for (const item of prevList || []) {
    const other = nextById.get(item.id);
    if (!other) return false;
    if (item.updated_at != null && other.updated_at != null) {
      if (item.updated_at !== other.updated_at) return false;
    } else if (!downloadRowEqual(item, other)) {
      return false;
    }
  }
  return true;
}

/**
 * Compute changed/inserted rows and removals between two authoritative lists.
 * @param {object[]} prevList
 * @param {object[]} currList
 */
export function computeDelta(prevList, currList) {
  const prevIds = new Set((prevList || []).map((item) => item.id));
  const currIds = new Set((currList || []).map((item) => item.id));
  const prevById = new Map((prevList || []).map((item) => [item.id, item]));

  const removed = [...prevIds].filter((id) => !currIds.has(id));
  const data = [];

  for (const item of currList || []) {
    if (!prevIds.has(item.id)) {
      data.push(item);
      continue;
    }
    const prev = prevById.get(item.id);
    if (prev && !listsEqual([prev], [item])) {
      data.push(item);
    }
  }

  return { data, removed };
}

/**
 * @param {Map<number, RevSnapshot>} revHistory
 * @param {number} currentRev
 */
function pruneRevHistory(revHistory, currentRev) {
  for (const rev of revHistory.keys()) {
    if (rev < currentRev - REV_HISTORY_LIMIT) {
      revHistory.delete(rev);
    }
  }
}

/**
 * @param {SyncKeyState} state
 * @param {CacheEntry} existing
 * @param {number} nextRev
 */
function archiveRevSnapshot(state, existing, nextRev) {
  if (!existing) return;
  state.revHistory.set(existing.rev, {
    rev: existing.rev,
    compressedBody: existing.compressedBody,
    data: Array.isArray(existing.data) ? existing.data : undefined,
  });
  pruneRevHistory(state.revHistory, nextRev);
}

/**
 * @param {SyncKeyState} state
 * @param {number} clientRev
 */
function getClientBaseSnapshot(state, clientRev) {
  return state.revHistory.get(clientRev) ?? null;
}

/**
 * @param {string} authId
 * @param {string} type
 * @returns {CacheEntry | null}
 */
function getEntry(authId, type) {
  const key = getCacheKey(authId, type);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.lastAccess > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  entry.lastAccess = Date.now();
  return entry;
}

/**
 * @param {CacheEntry | null | undefined} entry
 */
function getEntryData(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.data)) return entry.data;
  if (!entry.compressedBody) return [];
  const parsed = decompressBody(entry.compressedBody);
  return Array.isArray(parsed.data) ? parsed.data : [];
}

/**
 * @param {string} authId
 * @param {string} type
 * @param {object[]} data
 * @param {Partial<CacheEntry>} [meta]
 */
function writeEntry(authId, type, data, meta = {}) {
  const key = getCacheKey(authId, type);
  const now = Date.now();
  const existing = cache.get(key);
  const list = Array.isArray(data) ? data : [];
  const rev = meta.rev ?? (existing?.rev ?? 0) + 1;

  if (existing && existing.rev !== rev) {
    archiveRevSnapshot(getSyncState(key), existing, rev);
  }

  const entry = {
    data: list,
    compressedBody: buildCompressedBody(list, rev),
    rev,
    itemCount: list.length,
    lastAccess: now,
    lastShallowPollAt: meta.lastShallowPollAt ?? existing?.lastShallowPollAt ?? null,
    lastFullReconcileAt: meta.lastFullReconcileAt ?? existing?.lastFullReconcileAt ?? null,
    reconcileState: meta.reconcileState ?? existing?.reconcileState ?? 'fresh',
    reconcileError: meta.reconcileError ?? existing?.reconcileError ?? null,
    isMultiPage: meta.isMultiPage ?? existing?.isMultiPage ?? false,
    lastReconcileAttemptAt:
      meta.lastReconcileAttemptAt !== undefined
        ? meta.lastReconcileAttemptAt
        : (existing?.lastReconcileAttemptAt ?? null),
    reconcileFailureCount:
      meta.reconcileFailureCount !== undefined
        ? meta.reconcileFailureCount
        : (existing?.reconcileFailureCount ?? 0),
  };

  cache.set(key, entry);
  return { entry, rev };
}

/**
 * @param {CacheEntry} entry
 * @param {{ status?: number, syncMode?: string }} [options]
 */
function serveSnapshot(entry, { status = 200, syncMode = 'full' } = {}) {
  const headers = {
    'x-list-rev': String(entry.rev),
    'x-sync-item-count': String(entry.itemCount),
    'x-sync-mode': status === 304 ? 'unchanged' : syncMode,
  };

  if (status === 304) {
    return { status: 304, headers };
  }

  return {
    status: 200,
    compressedBody: entry.compressedBody,
    headers,
  };
}

/**
 * @param {{ data: object[], removed: (number|string)[], rev: number, itemCount: number }} payload
 */
function serveDelta({ data, removed, rev, itemCount }) {
  const changedCount = (data?.length || 0) + (removed?.length || 0);
  return {
    status: 200,
    compressedBody: buildCompressedDeltaBody(data || [], removed || [], rev),
    headers: {
      'x-list-rev': String(rev),
      'x-sync-item-count': String(itemCount),
      'x-sync-delta-count': String(changedCount),
      'x-sync-mode': 'delta',
    },
  };
}

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.lastAccess > CACHE_TTL_MS) {
      const state = syncStateByKey.get(key);
      if (state?.fullReconcilePromise || state?.shallowRefreshPromise) continue;
      cache.delete(key);
      syncStateByKey.delete(key);
      const timer = mutationReconcileTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        mutationReconcileTimers.delete(key);
      }
    }
  }
}

if (typeof setInterval !== 'undefined') {
  const INTERVAL_KEY = '__downloadListSyncEvictInterval';
  if (global[INTERVAL_KEY]) {
    clearInterval(global[INTERVAL_KEY]);
  }
  global[INTERVAL_KEY] = setInterval(evictExpired, 5 * 60 * 1000);
}

/**
 * @param {string} authId
 * @param {string} type
 * @param {CacheEntry} entry
 */
function isBackgroundReconcileDue(authId, type, entry) {
  const jitter = reconcileJitterMs(authId, type);
  const dueAt = (entry.lastFullReconcileAt || 0) + RECONCILE_INTERVAL_MS + jitter;
  const failureBackoff = reconcileFailureBackoffMs(entry.reconcileFailureCount || 0);
  const attemptDueAt = (entry.lastReconcileAttemptAt || 0) + failureBackoff;
  return Date.now() >= Math.max(dueAt, attemptDueAt);
}

/**
 * @param {string} apiKey
 * @param {string} type
 * @param {{ blocking?: boolean }} [options]
 */
export async function runFullReconciliation(apiKey, type, { blocking = true } = {}) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const state = getSyncState(key);

  if (state.fullReconcilePromise) {
    if (blocking) {
      const existing = await state.fullReconcilePromise;
      if (existing?.success === false) {
        throw existing.error;
      }
      return existing;
    }
    return undefined;
  }

  const reconcileTask = (async () => {
    const now = Date.now();
    const existingEntry = getEntry(authId, type);
    const publishGenerationAtStart = state.publishGeneration;
    const revAtStart = existingEntry?.rev ?? null;

    if (existingEntry) {
      existingEntry.reconcileState = 'reconciling';
      existingEntry.reconcileError = null;
      existingEntry.lastReconcileAttemptAt = now;
    }

    const started = Date.now();

    try {
      const result = await fetchFullDownloadList(apiKey, type);
      const isMultiPage = isMultiPageFromFullReconcile(result.data, result.pageCount);

      if (revAtStart != null && !cache.has(key)) {
        return { success: false, error: new Error('cache evicted during reconcile') };
      }

      const currentEntry = cache.get(key);
      if (
        state.publishGeneration !== publishGenerationAtStart ||
        (revAtStart != null && currentEntry?.rev !== revAtStart)
      ) {
        console.info(
          `[downloadListSync] full reconcile ${type}: skipped publish (mutation during reconcile)`
        );
        scheduleMutationReconcile(apiKey, type);
        return { success: true, skipped: true };
      }

      const previousData = currentEntry ? getEntryData(currentEntry) : [];
      if (currentEntry && listsEqual(previousData, result.data)) {
        const now = Date.now();
        currentEntry.lastFullReconcileAt = now;
        currentEntry.lastShallowPollAt = now;
        currentEntry.reconcileState = 'fresh';
        currentEntry.reconcileError = null;
        currentEntry.reconcileFailureCount = 0;
        currentEntry.isMultiPage = isMultiPage;
        console.info(
          `[downloadListSync] full reconcile ${type}: unchanged (${result.data.length} items), rev ${currentEntry.rev}`
        );
        return {
          success: result.success,
          data: result.data,
          rev: currentEntry.rev,
          unchanged: true,
        };
      }

      const { rev } = writeEntry(authId, type, result.data, {
        lastFullReconcileAt: Date.now(),
        lastShallowPollAt: Date.now(),
        reconcileState: 'fresh',
        reconcileError: null,
        isMultiPage,
        reconcileFailureCount: 0,
      });

      console.info(
        `[downloadListSync] full reconcile ${type}: ${result.data.length} items, ${result.pageCount} pages, ${Date.now() - started}ms`
      );

      return { success: result.success, data: result.data, rev };
    } catch (error) {
      const reconcileError = error?.message || 'reconcile failed';

      const entry = cache.get(key);
      if (entry) {
        entry.reconcileState = 'error';
        entry.reconcileError = reconcileError;
        entry.reconcileFailureCount = (entry.reconcileFailureCount || 0) + 1;
      }

      console.error(`[downloadListSync] full reconcile failed ${type}:`, reconcileError);
      return { success: false, error, reconcileError };
    }
  })();

  state.fullReconcilePromise = reconcileTask;
  reconcileTask.finally(() => {
    if (state.fullReconcilePromise === reconcileTask) {
      state.fullReconcilePromise = null;
    }
  });

  const result = await reconcileTask;

  if (result.success === false) {
    if (blocking) {
      throw result.error;
    }
    return undefined;
  }

  if (blocking) {
    return result;
  }

  return undefined;
}

/**
 * @param {string} apiKey
 * @param {string} type
 * @param {{ blocking?: boolean }} [options]
 */
async function runShallowRefresh(apiKey, type, { blocking = true } = {}) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const state = getSyncState(key);

  if (state.shallowRefreshPromise) {
    if (blocking) {
      return state.shallowRefreshPromise;
    }
    return undefined;
  }

  const refreshTask = (async () => {
    const attemptAt = Date.now();
    state.lastShallowAttemptAt = attemptAt;

    try {
      const entry = getEntry(authId, type);
      if (!entry) {
        return { success: false };
      }

      const revBefore = entry.rev;
      const prevList = getEntryData(entry);
      const isMultiPage = entry.isMultiPage;

      const shallow = await fetchShallowDownloadList(apiKey, type);
      if (!shallow?.success) {
        throw new Error('SHALLOW_FETCH_FAILED');
      }

      if (state.fullReconcilePromise) {
        await state.fullReconcilePromise.catch(() => {});
      }

      const currentEntry = getEntry(authId, type);
      if (!currentEntry || !cache.has(key)) {
        return { success: false };
      }

      if (currentEntry.rev !== revBefore) {
        state.shallowFailureCount = 0;
        return { success: true };
      }

      const boundaryCrossed = !isMultiPage && shallow.regularPageLength >= MYLIST_PAGE_LIMIT;
      const effectiveMultiPage = isMultiPage || boundaryCrossed;
      const nextList = effectiveMultiPage
        ? applyShallowPatch(prevList, shallow.data)
        : applySinglePageShallowMerge(shallow.data);

      const now = Date.now();
      const listChanged = !listsEqual(prevList, nextList);
      const hasChanges = boundaryCrossed || listChanged;

      if (listChanged) {
        writeEntry(authId, type, nextList, {
          lastShallowPollAt: now,
          isMultiPage: effectiveMultiPage,
        });

        if (effectiveMultiPage) {
          scheduleBackgroundReconcileIfDue(apiKey, type);
        }
        if (boundaryCrossed) {
          scheduleMutationReconcile(apiKey, type);
        }
      } else if (hasChanges) {
        currentEntry.lastShallowPollAt = now;
        currentEntry.isMultiPage = effectiveMultiPage;
        if (boundaryCrossed) {
          scheduleMutationReconcile(apiKey, type);
        }
      } else {
        currentEntry.lastShallowPollAt = now;
      }

      state.shallowFailureCount = 0;
      return { success: true };
    } catch (error) {
      state.shallowFailureCount = (state.shallowFailureCount || 0) + 1;
      console.error(
        `[downloadListSync] shallow refresh failed ${type}:`,
        error?.message || 'shallow refresh failed'
      );
      return { success: false };
    }
  })();

  state.shallowRefreshPromise = refreshTask;
  refreshTask.finally(() => {
    if (state.shallowRefreshPromise === refreshTask) {
      state.shallowRefreshPromise = null;
    }
  });

  if (blocking) {
    return refreshTask;
  }

  refreshTask.catch(() => {});
  return undefined;
}

/**
 * Blocking shallow refresh when TorBox data may be stale. Coalesced via shallowRefreshPromise.
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<boolean>} true when a refresh attempt ran (success or failure)
 */
async function ensureShallowRefreshIfStale(apiKey, type, { force = false } = {}) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const entry = getEntry(authId, type);
  if (!entry) return false;

  const state = getSyncState(key);
  const lastPoll = entry.lastShallowPollAt || 0;
  if (!force && Date.now() - lastPoll < SHALLOW_FRESHNESS_MS) return false;

  const shallowBackoff = shallowFailureBackoffMs(state.shallowFailureCount || 0);
  const lastAttempt = state.lastShallowAttemptAt || 0;
  if (state.shallowFailureCount > 0 && Date.now() - lastAttempt < shallowBackoff) return false;

  await runShallowRefresh(apiKey, type, { blocking: true });
  return true;
}

/**
 * @param {string} authId
 * @param {string} type
 * @param {CacheEntry} entry
 * @param {number | null} clientRev
 * @param {boolean} isValidRev
 */
function serveForClientRev(authId, type, entry, clientRev, isValidRev) {
  if (isValidRev && clientRev === entry.rev) {
    return serveSnapshot(entry, { status: 304 });
  }

  if (isValidRev && clientRev < entry.rev) {
    const state = getSyncState(getCacheKey(authId, type));
    const baseSnapshot = getClientBaseSnapshot(state, clientRev);
    if (baseSnapshot) {
      const { data, removed } = computeDelta(getSnapshotData(baseSnapshot), getEntryData(entry));
      if (data.length === 0 && removed.length === 0) {
        // Rev advanced (e.g. no-op full reconcile) but catalog matches client's snapshot.
        return serveSnapshot(entry, { status: 304 });
      }
      return serveDelta({
        data,
        removed,
        rev: entry.rev,
        itemCount: entry.itemCount,
      });
    }
  }

  return serveSnapshot(entry, {
    syncMode: isValidRev && clientRev < entry.rev ? 'stale-full' : 'full',
  });
}

/**
 * @param {string} apiKey
 * @param {string} type
 * @returns {Promise<'full' | 'shallow'>}
 */
async function runForegroundRefresh(apiKey, type) {
  const authId = hashApiKey(apiKey);
  let entry = getEntry(authId, type);

  if (!entry) {
    await runFullReconciliation(apiKey, type, { blocking: true });
    return 'full';
  }

  await runShallowRefresh(apiKey, type, { blocking: true });

  entry = getEntry(authId, type);
  if (!entry?.isMultiPage) return 'shallow';

  const state = getSyncState(getCacheKey(authId, type));
  if (!isBackgroundReconcileDue(authId, type, entry)) return 'shallow';
  if (state.fullReconcilePromise) {
    await state.fullReconcilePromise.catch(() => {});
    return 'shallow';
  }

  await runFullReconciliation(apiKey, type, { blocking: true });
  return 'full';
}

/**
 * @param {string} apiKey
 * @param {string} type
 */
export function scheduleBackgroundReconcileIfDue(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const entry = getEntry(authId, type);
  if (!entry) return;

  if (!entry.isMultiPage) return;

  const state = getSyncState(key);
  if (!isBackgroundReconcileDue(authId, type, entry)) return;
  if (state.fullReconcilePromise) return;

  runFullReconciliation(apiKey, type, { blocking: false }).catch(() => {});
}

/**
 * Schedule a near-term full reconcile after trusted mutations (debounced per user/type).
 * @param {string} apiKey
 * @param {string} type
 */
export function scheduleMutationReconcile(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const existing = mutationReconcileTimers.get(key);
  if (existing) clearTimeout(existing);

  mutationReconcileTimers.set(
    key,
    setTimeout(() => {
      mutationReconcileTimers.delete(key);
      if (!getEntry(authId, type)) return;
      runFullReconciliation(apiKey, type, { blocking: false }).catch(() => {});
    }, MUTATION_RECONCILE_DELAY_MS)
  );
}

/**
 * Trusted mutation: remove known IDs from server cache immediately.
 * @param {string} apiKey
 * @param {string} type
 * @param {(number|string)[]} ids
 */
export async function patchCacheRemoveIds(apiKey, type, ids) {
  if (!ids?.length) return;

  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const entry = getEntry(authId, type);
  if (!entry) return;

  const state = getSyncState(key);
  state.publishGeneration += 1;

  const idSet = new Set(ids);
  const data = getEntryData(entry).filter((item) => !idSet.has(item.id));
  writeEntry(authId, type, data, {
    reconcileState: 'stale',
    isMultiPage: entry.isMultiPage,
  });
  scheduleMutationReconcile(apiKey, type);
}

/**
 * Single entry point for torrents/usenet/webdl GET list sync.
 * @param {{ apiKey: string, type: string, rev: number | null, bypassCache: boolean, forceListSync?: boolean }} params
 */
export async function handleListSyncRequest({
  apiKey,
  type,
  rev,
  bypassCache,
  forceListSync = false,
}) {
  const authId = hashApiKey(apiKey);
  const clientRev = rev != null && rev !== '' ? Number(rev) : null;
  const isValidRev = clientRev != null && Number.isInteger(clientRev) && clientRev >= 0;

  if (bypassCache) {
    try {
      await runForegroundRefresh(apiKey, type);
      const entry = getEntry(authId, type);
      if (!entry) {
        throw new Error('Cache miss after foreground refresh');
      }
      return serveForClientRev(authId, type, entry, clientRev, isValidRev);
    } catch (error) {
      const entry = getEntry(authId, type);
      if (entry) {
        return serveForClientRev(authId, type, entry, clientRev, isValidRev);
      }
      throw error;
    }
  }

  let entry = getEntry(authId, type);

  if (!entry) {
    await runFullReconciliation(apiKey, type, { blocking: true });
    entry = getEntry(authId, type);
    if (!entry) {
      throw new Error('Cache miss after full reconcile');
    }
    return serveSnapshot(entry, { syncMode: 'full' });
  }

  await ensureShallowRefreshIfStale(apiKey, type, { force: forceListSync });

  entry = getEntry(authId, type);
  if (!entry) {
    throw new Error('Cache miss after shallow refresh');
  }

  return serveForClientRev(authId, type, entry, clientRev, isValidRev);
}

/**
 * Build a fetch Response from handleListSyncRequest result.
 * @param {{ status: number, compressedBody?: Buffer, headers: Record<string, string> }} result
 * @param {Record<string, string>} cacheHeaders
 */
export function buildListSyncResponse(result, cacheHeaders) {
  if (result.status === 304) {
    return new Response(null, {
      status: 304,
      headers: { ...cacheHeaders, ...result.headers },
    });
  }

  return new Response(result.compressedBody, {
    headers: {
      ...cacheHeaders,
      'Content-Type': 'application/json',
      'Content-Encoding': 'gzip',
      ...result.headers,
    },
  });
}

/** @internal test helper */
export async function resetDownloadListSyncForTests() {
  for (const timer of mutationReconcileTimers.values()) {
    clearTimeout(timer);
  }
  mutationReconcileTimers.clear();

  const pending = [
    ...syncStateByKey
      .values()
      .flatMap((state) => [state.fullReconcilePromise, state.shallowRefreshPromise])
      .filter(Boolean),
  ];
  await Promise.allSettled(pending);

  cache.clear();
  syncStateByKey.clear();
}

/** @internal test helper */
export function getDownloadListSyncCacheEntry(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const entry = getEntry(authId, type);
  if (!entry) return null;
  return {
    data: getEntryData(entry),
    rev: entry.rev,
    reconcileState: entry.reconcileState,
    lastFullReconcileAt: entry.lastFullReconcileAt,
    lastShallowPollAt: entry.lastShallowPollAt,
    isMultiPage: entry.isMultiPage,
    reconcileFailureCount: entry.reconcileFailureCount ?? 0,
  };
}

/** @internal test helper */
export function setDownloadListSyncCacheMetaForTests(apiKey, type, meta) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const entry = cache.get(key);
  if (!entry) return;
  Object.assign(entry, meta);
}

/** @internal test helper */
export async function flushMutationReconcileTimerForTests(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const timer = mutationReconcileTimers.get(key);
  if (!timer) return;
  clearTimeout(timer);
  mutationReconcileTimers.delete(key);
  if (!getEntry(authId, type)) return;
  await runFullReconciliation(apiKey, type, { blocking: false });
}

/** @internal test helper */
export function clearDownloadListSyncCacheOnlyForTests() {
  cache.clear();
}

/** @internal test helper — exported for unit tests */
export {
  reconcileFailureBackoffMs,
  shallowFailureBackoffMs,
  runShallowRefresh,
  ensureShallowRefreshIfStale,
};

/** @internal test helper */
export function setDownloadListSyncCacheForTests(apiKey, type, data, { isMultiPage } = {}) {
  const authId = hashApiKey(apiKey);
  const multiPage = isMultiPage ?? !isSinglePageCatalog(data);
  const { rev } = writeEntry(authId, type, data, {
    lastFullReconcileAt: Date.now(),
    lastShallowPollAt: Date.now(),
    isMultiPage: multiPage,
  });
  return rev;
}
