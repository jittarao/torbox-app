/**
 * Server-only authoritative download list sync cache.
 * Rev-tagged full snapshots live on disk (immutable `*.rev.N.gz` bodies +
 * atomic JSON meta + hot-path `*.gz` mirror). Reads serve cached gzip bodies
 * (304 when current); stale reads block on a coalesced TorBox shallow refresh
 * before responding.
 *
 * No durable in-memory catalog — only lightweight per-key coordination
 * (coalesced promises) stays in process RAM. Shallow failure backoff is also
 * persisted in disk meta so restarts honor TorBox fault holds.
 * Single Next.js instance assumed (Docker Compose default).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { hashApiKey } from '@/app/api/lib/hashApiKey';
import {
  fetchFullDownloadList,
  fetchShallowDownloadList,
  MYLIST_PAGE_LIMIT,
  sortByAddedDesc,
} from '@/app/api/lib/fetchTorboxDownloadList';
import { isTorboxServerFault } from '@/config/errors';
import { downloadRowEqual } from '@/utils/downloadListMerge';
import { extractPublicErrorCode } from '@/utils/sanitizeError';

const CACHE_TTL_MS = Number(process.env.DOWNLOAD_SYNC_CACHE_TTL_MS) || 24 * 60 * 60 * 1000;
const RECONCILE_INTERVAL_MS =
  Number(process.env.DOWNLOAD_SYNC_RECONCILE_INTERVAL_MS) || 5 * 60 * 1000;
const RECONCILE_JITTER_MS = Number(process.env.DOWNLOAD_SYNC_RECONCILE_JITTER_MS) || 60 * 1000;
const SHALLOW_FRESHNESS_MS = Number(process.env.DOWNLOAD_SYNC_SHALLOW_FRESHNESS_MS) || 10 * 1000;
const MUTATION_RECONCILE_DELAY_MS = 30 * 1000;
const RECONCILE_FAILURE_BACKOFF_BASE_MS = 15 * 1000;
const RECONCILE_FAILURE_BACKOFF_MAX_MS = RECONCILE_INTERVAL_MS;
/** Client faults (e.g. PLAN_RESTRICTED) — avoid hammering TorBox on every poll. */
const NON_RETRYABLE_RECONCILE_BACKOFF_MS =
  Number(process.env.DOWNLOAD_SYNC_NON_RETRYABLE_BACKOFF_MS) || 15 * 60 * 1000;
const SHALLOW_FAILURE_BACKOFF_BASE_MS = 5 * 1000;
const SHALLOW_FAILURE_BACKOFF_MAX_MS = SHALLOW_FRESHNESS_MS;
const RECONCILE_FAILURE_LOG_RATE_MS = 60 * 1000;
const EVICT_INTERVAL_MS = 5 * 60 * 1000;
/** Debounce lastAccess meta writes — TTL is hours, not seconds. */
const LAST_ACCESS_TOUCH_INTERVAL_MS =
  Number(process.env.DOWNLOAD_SYNC_LAST_ACCESS_TOUCH_MS) || 5 * 60 * 1000;
const DEFAULT_DISK_CACHE_DIR = '.download-list-cache';

/** @type {Map<string, number>} */
const reconcileFailureLogAt = new Map();
// Disk-backed; higher default is fine (deltas avoid full snapshot downloads).
const REV_HISTORY_LIMIT = Math.max(1, Number(process.env.DOWNLOAD_SYNC_REV_HISTORY_LIMIT) || 10);
const GZIP_LEVEL = 6;

/** @type {string | null} */
let diskCacheDirOverride = null;
/** @type {string | null} */
let diskDirEnsured = null;
/** @type {number} */
let diskFailureLogAt = 0;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const mutationReconcileTimers = new Map();

/**
 * Per-key sync coordination only (no catalog bodies).
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
 * @property {string | null} lastShallowError
 */

/**
 * @typedef {object} RevSnapshot
 * @property {number} rev
 * @property {Buffer} compressedBody
 */

/**
 * @typedef {object} CacheEntry
 * @property {null} [data] — intentionally omitted; catalog lives in compressedBody only
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
 * @property {number | null} [lastShallowAttemptAt]
 * @property {number} [shallowFailureCount]
 * @property {string | null} [lastShallowError]
 */

function getDiskCacheDir() {
  if (diskCacheDirOverride) return diskCacheDirOverride;
  if (process.env.DOWNLOAD_SYNC_DISK_CACHE_DIR) {
    return process.env.DOWNLOAD_SYNC_DISK_CACHE_DIR;
  }
  return path.join(process.cwd(), DEFAULT_DISK_CACHE_DIR);
}

/**
 * @returns {string}
 */
function ensureDiskDir() {
  const dir = getDiskCacheDir();
  if (diskDirEnsured !== dir) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      /* best-effort on platforms that ignore mode */
    }
    diskDirEnsured = dir;
  }
  return dir;
}

/**
 * Write then rename so readers never observe a partial file (same-filesystem POSIX).
 * @param {string} filePath
 * @param {string | Buffer} data
 * @param {number} [mode]
 */
function atomicWriteFile(filePath, data, mode = 0o600) {
  const dir = path.dirname(filePath);
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  );
  fs.writeFileSync(tmp, data, { mode });
  try {
    fs.chmodSync(tmp, mode);
  } catch {
    /* best-effort */
  }
  fs.renameSync(tmp, filePath);
}

/**
 * @param {string} key
 */
function safeDiskFilename(key) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * @param {string} key
 */
function diskPathsForKey(key) {
  const base = path.join(getDiskCacheDir(), safeDiskFilename(key));
  return {
    metaPath: `${base}.json`,
    bodyPath: `${base}.gz`,
    revPath: (rev) => `${base}.rev.${rev}.gz`,
    stem: safeDiskFilename(key),
  };
}

function logDiskFailure(message) {
  const now = Date.now();
  if (now - diskFailureLogAt < RECONCILE_FAILURE_LOG_RATE_MS) return;
  diskFailureLogAt = now;
  console.warn(`[downloadListSync] disk cache: ${message}`);
}

/**
 * @param {string} key
 */
function deleteDiskRevHistory(key) {
  const dir = getDiskCacheDir();
  const { stem } = diskPathsForKey(key);
  const prefix = `${stem}.rev.`;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.gz')) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {string} key
 */
function deleteDiskEntry(key) {
  const { metaPath, bodyPath } = diskPathsForKey(key);
  try {
    fs.unlinkSync(metaPath);
  } catch {
    /* missing is fine */
  }
  try {
    fs.unlinkSync(bodyPath);
  } catch {
    /* missing is fine */
  }
  deleteDiskRevHistory(key);
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function diskEntryExists(key) {
  const { metaPath, bodyPath } = diskPathsForKey(key);
  try {
    return fs.existsSync(metaPath) && fs.existsSync(bodyPath);
  } catch {
    return false;
  }
}

/**
 * @param {object} meta
 * @returns {Omit<CacheEntry, 'compressedBody'> & { compressedBody: null }}
 */
function metaToEntryShell(meta) {
  return {
    data: null,
    compressedBody: null,
    rev: meta.rev ?? 0,
    itemCount: meta.itemCount ?? 0,
    lastAccess: meta.lastAccess ?? Date.now(),
    lastShallowPollAt: meta.lastShallowPollAt ?? null,
    lastFullReconcileAt: meta.lastFullReconcileAt ?? null,
    reconcileState: meta.reconcileState ?? 'fresh',
    reconcileError: meta.reconcileError ?? null,
    isMultiPage: Boolean(meta.isMultiPage),
    lastReconcileAttemptAt: meta.lastReconcileAttemptAt ?? null,
    reconcileFailureCount: meta.reconcileFailureCount ?? 0,
    lastShallowAttemptAt: meta.lastShallowAttemptAt ?? null,
    shallowFailureCount: meta.shallowFailureCount ?? 0,
    lastShallowError: meta.lastShallowError ?? null,
  };
}

/**
 * @param {string} key
 * @returns {ReturnType<typeof metaToEntryShell> | null}
 */
function readDiskMetaOnly(key) {
  const { metaPath } = diskPathsForKey(key);
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    return metaToEntryShell(meta);
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @returns {Buffer | null}
 */
function readDiskBodyOnly(key) {
  const { bodyPath } = diskPathsForKey(key);
  try {
    const compressedBody = fs.readFileSync(bodyPath);
    if (!Buffer.isBuffer(compressedBody) || compressedBody.length === 0) return null;
    return compressedBody;
  } catch {
    return null;
  }
}

/**
 * @param {string} key
 * @param {CacheEntry} entry
 * @returns {boolean}
 */
function writeDiskMeta(key, entry) {
  try {
    ensureDiskDir();
    const { metaPath } = diskPathsForKey(key);
    const meta = {
      rev: entry.rev,
      itemCount: entry.itemCount,
      lastAccess: entry.lastAccess,
      lastShallowPollAt: entry.lastShallowPollAt,
      lastFullReconcileAt: entry.lastFullReconcileAt,
      reconcileState: entry.reconcileState,
      reconcileError: entry.reconcileError,
      isMultiPage: entry.isMultiPage,
      lastReconcileAttemptAt: entry.lastReconcileAttemptAt,
      reconcileFailureCount: entry.reconcileFailureCount,
      lastShallowAttemptAt: entry.lastShallowAttemptAt ?? null,
      shallowFailureCount: entry.shallowFailureCount ?? 0,
      lastShallowError: entry.lastShallowError ?? null,
    };
    atomicWriteFile(metaPath, JSON.stringify(meta), 0o600);
    return true;
  } catch (error) {
    logDiskFailure(error?.message || 'meta write failed');
    return false;
  }
}

/**
 * Publish an immutable rev body first, then current-body mirror, then meta.
 * Meta is written last so it never points at a missing/partial body.
 * @param {string} key
 * @param {CacheEntry} entry
 * @returns {boolean}
 */
function writeDiskEntry(key, entry) {
  if (!entry?.compressedBody) return false;
  try {
    ensureDiskDir();
    const { bodyPath, revPath } = diskPathsForKey(key);
    // Immutable revision snapshot — source of truth for deltas / crash recovery.
    atomicWriteFile(revPath(entry.rev), entry.compressedBody, 0o600);
    // Hot-path mirror for current head reads.
    atomicWriteFile(bodyPath, entry.compressedBody, 0o600);
    if (!writeDiskMeta(key, entry)) return false;
    pruneRevHistoryOnDisk(key, entry.rev);
    return true;
  } catch (error) {
    logDiskFailure(error?.message || 'write failed');
    return false;
  }
}

/**
 * @param {string} key
 * @param {CacheEntry} entry
 */
function persistEntry(key, entry) {
  if (!writeDiskEntry(key, entry)) {
    throw new Error('download list disk cache write failed');
  }
}

/**
 * @param {string} key
 * @param {CacheEntry} entry
 */
function persistEntryMeta(key, entry) {
  if (!writeDiskMeta(key, entry)) {
    throw new Error('download list disk cache meta write failed');
  }
}

/**
 * @param {string} key
 * @returns {CacheEntry | null}
 */
function readDiskEntry(key) {
  const shell = readDiskMetaOnly(key);
  if (!shell) return null;
  const compressedBody = readDiskBodyOnly(key);
  if (!compressedBody) {
    deleteDiskEntry(key);
    return null;
  }
  try {
    const parsed = decompressBody(compressedBody);
    if (parsed?.rev != null && parsed.rev !== shell.rev) {
      deleteDiskEntry(key);
      return null;
    }
  } catch {
    deleteDiskEntry(key);
    return null;
  }
  shell.compressedBody = compressedBody;
  return shell;
}

/**
 * Ensure gzip body is loaded (304 / freshness checks skip this).
 * @param {CacheEntry} entry
 * @param {string} key
 * @returns {boolean}
 */
function ensureEntryBody(entry, key) {
  if (entry?.compressedBody) return true;
  const compressedBody = readDiskBodyOnly(key);
  if (!compressedBody) {
    deleteDiskEntry(key);
    return false;
  }
  try {
    const parsed = decompressBody(compressedBody);
    if (parsed?.rev != null && parsed.rev !== entry.rev) {
      deleteDiskEntry(key);
      return false;
    }
  } catch {
    deleteDiskEntry(key);
    return false;
  }
  entry.compressedBody = compressedBody;
  return true;
}

/**
 * Drop in-memory coordination for a key; optionally wipe disk snapshots.
 * @param {string} key
 * @param {{ deleteDisk?: boolean }} [options]
 */
function forgetKey(key, { deleteDisk = false } = {}) {
  syncStateByKey.delete(key);
  const timer = mutationReconcileTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    mutationReconcileTimers.delete(key);
  }
  if (deleteDisk) {
    deleteDiskEntry(key);
  }
}

/**
 * Rethrow a known list-sync failure without re-logging on every client poll.
 * @param {string} message
 * @returns {Error}
 */
export function cachedListSyncError(message) {
  const error = new Error(message || 'reconcile failed');
  error.listSyncCached = true;
  return error;
}

/**
 * Remove disk entries whose lastAccess exceeds CACHE_TTL_MS.
 */
function evictExpiredDiskEntries() {
  let dir;
  try {
    dir = getDiskCacheDir();
    if (!fs.existsSync(dir)) return;
  } catch {
    return;
  }

  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }

  const now = Date.now();
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    const metaPath = path.join(dir, name);
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (now - (meta.lastAccess || 0) <= CACHE_TTL_MS) continue;

      const stem = name.slice(0, -'.json'.length);
      let skipDelete = false;
      for (const key of [...syncStateByKey.keys()]) {
        if (safeDiskFilename(key) !== stem) continue;
        const state = syncStateByKey.get(key);
        if (state?.fullReconcilePromise || state?.shallowRefreshPromise) {
          // Keep disk while a refresh is in flight; retry next sweep.
          skipDelete = true;
          break;
        }
        forgetKey(key, { deleteDisk: false });
      }
      if (skipDelete) continue;

      try {
        fs.unlinkSync(metaPath);
      } catch {
        /* ignore */
      }
      try {
        fs.unlinkSync(path.join(dir, `${stem}.gz`));
      } catch {
        /* ignore */
      }
      const prefix = `${stem}.rev.`;
      for (const revName of names) {
        if (!revName.startsWith(prefix) || !revName.endsWith('.gz')) continue;
        try {
          fs.unlinkSync(path.join(dir, revName));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore corrupt */
    }
  }
}

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
    const meta = readDiskMetaOnly(key);
    state = {
      fullReconcilePromise: null,
      shallowRefreshPromise: null,
      publishGeneration: 0,
      lastShallowAttemptAt: meta?.lastShallowAttemptAt ?? null,
      shallowFailureCount: meta?.shallowFailureCount ?? 0,
      lastShallowError: meta?.lastShallowError ?? null,
    };
    syncStateByKey.set(key, state);
  }
  return state;
}

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

/**
 * Longer hold for permanent client faults / noisy AUTH_ERROR so cold-miss
 * polls do not re-hit TorBox every few seconds.
 * @param {number} failureCount
 * @param {string | null | undefined} reconcileError
 */
function effectiveReconcileFailureBackoffMs(failureCount, reconcileError) {
  const base = reconcileFailureBackoffMs(failureCount);
  const code = extractPublicErrorCode(reconcileError);
  if (code && !isTorboxServerFault(code)) {
    return Math.max(base, NON_RETRYABLE_RECONCILE_BACKOFF_MS);
  }
  // AUTH_ERROR is classified as a TorBox server fault but often sticks for
  // a given key; after the first repeat, hold for a full reconcile interval.
  if (code === 'AUTH_ERROR' && failureCount >= 2) {
    return Math.max(base, RECONCILE_INTERVAL_MS);
  }
  return base;
}

/**
 * Empty error placeholder written when the first reconcile fails (no prior catalog).
 * Must not be served as a successful snapshot.
 * @param {CacheEntry | null | undefined} entry
 */
function isFailedBootstrapEntry(entry) {
  return Boolean(entry && entry.reconcileState === 'error' && entry.lastFullReconcileAt == null);
}

/**
 * @param {string} type
 * @param {string} reconcileError
 * @param {number} failureCount
 * @param {'full' | 'shallow'} [kind]
 */
function logReconcileFailure(type, reconcileError, failureCount, kind = 'full') {
  const key = `${kind}:${type}:${reconcileError}`;
  const now = Date.now();
  const last = reconcileFailureLogAt.get(key) || 0;
  const code = extractPublicErrorCode(reconcileError);
  const expected =
    (code && !isTorboxServerFault(code)) ||
    code === 'AUTH_ERROR' ||
    isTimeoutLikeMessage(reconcileError);
  const rateMs = expected ? NON_RETRYABLE_RECONCILE_BACKOFF_MS : RECONCILE_FAILURE_LOG_RATE_MS;
  // First failure always logs; repeats honor the longer sticky-fault window.
  if (failureCount > 1 && now - last < rateMs) return;
  reconcileFailureLogAt.set(key, now);
  if (reconcileFailureLogAt.size > 200) {
    const cutoff = now - rateMs * 2;
    for (const [k, ts] of reconcileFailureLogAt) {
      if (ts < cutoff) reconcileFailureLogAt.delete(k);
    }
  }
  const label = kind === 'shallow' ? 'shallow refresh' : 'full reconcile';
  console.warn(`[downloadListSync] ${label} failed ${type}: ${reconcileError}`);
}

/**
 * @param {string | null | undefined} message
 */
function isTimeoutLikeMessage(message) {
  if (!message) return false;
  return (
    message.includes('Request timeout') ||
    message.includes('aborted due to timeout') ||
    message.includes('fetch failed') ||
    (message.includes('Unexpected token') && message.includes('JSON'))
  );
}

/**
 * Shallow failure backoff — permanent TorBox faults use the same hold as full reconcile.
 * @param {number} failureCount
 * @param {string | null | undefined} lastError
 */
function effectiveShallowFailureBackoffMs(failureCount, lastError) {
  const base = shallowFailureBackoffMs(failureCount);
  if (!lastError) return base;
  return Math.max(base, effectiveReconcileFailureBackoffMs(failureCount, lastError));
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
    if (!downloadRowEqual(item, other)) return false;
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
 * @param {string} key
 * @param {number} currentRev
 */
function pruneRevHistoryOnDisk(key, currentRev) {
  const dir = getDiskCacheDir();
  const { stem } = diskPathsForKey(key);
  const prefix = `${stem}.rev.`;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.gz')) continue;
    const rev = Number(name.slice(prefix.length, -'.gz'.length));
    if (!Number.isInteger(rev) || rev >= currentRev - REV_HISTORY_LIMIT) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch {
      /* ignore */
    }
  }
}

/**
 * @param {string} key
 * @param {CacheEntry} existing
 * @param {number} nextRev
 */
function archiveRevSnapshot(key, existing, nextRev) {
  if (!existing) return;
  if (!ensureEntryBody(existing, key)) return;
  // Gzip only — never retain the live uncompressed `data` array here. Deltas
  // decompress via getSnapshotData when a client polls with a stale rev.
  try {
    ensureDiskDir();
    const { revPath } = diskPathsForKey(key);
    atomicWriteFile(revPath(existing.rev), existing.compressedBody, 0o600);
  } catch (error) {
    logDiskFailure(error?.message || 'rev archive write failed');
  }
  pruneRevHistoryOnDisk(key, nextRev);
}

/**
 * @param {string} key
 * @param {number} clientRev
 * @returns {RevSnapshot | null}
 */
function getClientBaseSnapshot(key, clientRev) {
  const { revPath } = diskPathsForKey(key);
  try {
    const compressedBody = fs.readFileSync(revPath(clientRev));
    if (!Buffer.isBuffer(compressedBody) || compressedBody.length === 0) return null;
    return { rev: clientRev, compressedBody };
  } catch {
    return null;
  }
}

/**
 * @param {string} authId
 * @param {string} type
 * @param {{ touch?: boolean, body?: boolean }} [options]
 * @returns {CacheEntry | null}
 */
function getEntry(authId, type, { touch = true, body = true } = {}) {
  const key = getCacheKey(authId, type);
  // Hot path (304 / freshness): meta JSON only — skip multi-MB gzip reads.
  const entry = body ? readDiskEntry(key) : readDiskMetaOnly(key);
  if (!entry) return null;

  if (Date.now() - entry.lastAccess > CACHE_TTL_MS) {
    const state = syncStateByKey.get(key);
    if (state?.fullReconcilePromise || state?.shallowRefreshPromise) {
      // Refresh in flight — keep disk; eviction sweep retries after it finishes.
      return entry;
    }
    forgetKey(key, { deleteDisk: true });
    return null;
  }

  if (touch) {
    const now = Date.now();
    if (now - entry.lastAccess >= LAST_ACCESS_TOUCH_INTERVAL_MS) {
      entry.lastAccess = now;
      writeDiskMeta(key, entry);
    }
  }
  return entry;
}

/**
 * @param {CacheEntry | null | undefined} entry
 */
function getEntryData(entry) {
  if (!entry) return [];
  // Disk entries are gzip-only; decompress on demand for mutate/delta paths.
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
  // Prefer meta-only read; load body only when archiving the previous rev.
  let existing = readDiskMetaOnly(key);
  if (existing && (meta.rev == null || meta.rev !== existing.rev)) {
    ensureEntryBody(existing, key);
  }
  const list = Array.isArray(data) ? data : [];
  const rev = meta.rev ?? (existing?.rev ?? 0) + 1;

  if (existing && existing.rev !== rev) {
    archiveRevSnapshot(key, existing, rev);
  }

  const entry = {
    data: null,
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
    lastShallowAttemptAt:
      meta.lastShallowAttemptAt !== undefined
        ? meta.lastShallowAttemptAt
        : (existing?.lastShallowAttemptAt ?? null),
    shallowFailureCount:
      meta.shallowFailureCount !== undefined
        ? meta.shallowFailureCount
        : (existing?.shallowFailureCount ?? 0),
    lastShallowError:
      meta.lastShallowError !== undefined
        ? meta.lastShallowError
        : (existing?.lastShallowError ?? null),
  };

  persistEntry(key, entry);
  return { entry, rev };
}

/**
 * Persist shallow failure backoff to disk meta so restarts honor it.
 * @param {string} key
 * @param {SyncKeyState} state
 */
function persistShallowFailureState(key, state) {
  const entry = readDiskMetaOnly(key);
  if (!entry) return;
  entry.lastShallowAttemptAt = state.lastShallowAttemptAt;
  entry.shallowFailureCount = state.shallowFailureCount || 0;
  entry.lastShallowError = state.lastShallowError;
  writeDiskMeta(key, entry);
}

/**
 * Persist field updates without rewriting the gzip catalog body.
 * @param {string} authId
 * @param {string} type
 * @param {CacheEntry} entry
 * @param {Partial<CacheEntry>} fields
 */
function patchEntry(authId, type, entry, fields) {
  const key = getCacheKey(authId, type);
  Object.assign(entry, fields);
  entry.lastAccess = Date.now();
  persistEntryMeta(key, entry);
  return entry;
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

if (typeof setInterval !== 'undefined') {
  const EVICT_INTERVAL_KEY = '__downloadListSyncEvictInterval';
  if (global[EVICT_INTERVAL_KEY]) {
    clearInterval(global[EVICT_INTERVAL_KEY]);
  }
  global[EVICT_INTERVAL_KEY] = setInterval(evictExpiredDiskEntries, EVICT_INTERVAL_MS);
}

/**
 * @param {string} authId
 * @param {string} type
 * @param {CacheEntry} entry
 */
function isBackgroundReconcileDue(authId, type, entry) {
  const jitter = reconcileJitterMs(authId, type);
  const dueAt = (entry.lastFullReconcileAt || 0) + RECONCILE_INTERVAL_MS + jitter;
  const failureBackoff = effectiveReconcileFailureBackoffMs(
    entry.reconcileFailureCount || 0,
    entry.reconcileError
  );
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
    const existingEntry = getEntry(authId, type, { touch: false, body: false });
    const publishGenerationAtStart = state.publishGeneration;
    const revAtStart = existingEntry?.rev ?? null;

    if (existingEntry) {
      patchEntry(authId, type, existingEntry, {
        reconcileState: 'reconciling',
        reconcileError: null,
        lastReconcileAttemptAt: now,
      });
    }

    try {
      const result = await fetchFullDownloadList(apiKey, type);
      const isMultiPage = isMultiPageFromFullReconcile(result.data, result.pageCount);

      if (revAtStart != null && !diskEntryExists(key)) {
        return { success: false, error: new Error('cache evicted during reconcile') };
      }

      const currentEntry = getEntry(authId, type, { touch: false });
      if (
        state.publishGeneration !== publishGenerationAtStart ||
        (revAtStart != null && currentEntry?.rev !== revAtStart)
      ) {
        scheduleMutationReconcile(apiKey, type);
        return { success: true, skipped: true };
      }

      const previousData = currentEntry ? getEntryData(currentEntry) : [];
      if (currentEntry && listsEqual(previousData, result.data)) {
        const touchedAt = Date.now();
        patchEntry(authId, type, currentEntry, {
          lastFullReconcileAt: touchedAt,
          lastShallowPollAt: touchedAt,
          reconcileState: 'fresh',
          reconcileError: null,
          reconcileFailureCount: 0,
          isMultiPage,
        });
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

      return { success: result.success, data: result.data, rev };
    } catch (error) {
      const reconcileError = error?.message || 'reconcile failed';
      const now = Date.now();
      const entry = getEntry(authId, type, { touch: false, body: false });
      const failureCount = (entry?.reconcileFailureCount || 0) + 1;

      if (entry) {
        patchEntry(authId, type, entry, {
          reconcileState: 'error',
          reconcileError,
          reconcileFailureCount: failureCount,
          lastReconcileAttemptAt: now,
        });
      } else {
        // Negative cache so cold-miss polls honor backoff instead of re-hitting TorBox.
        writeEntry(authId, type, [], {
          reconcileState: 'error',
          reconcileError,
          reconcileFailureCount: failureCount,
          lastReconcileAttemptAt: now,
        });
      }

      // Background reconciles log here; blocking callers rethrow and the route logs once.
      if (!blocking) {
        logReconcileFailure(type, reconcileError, failureCount);
      }
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

      const currentEntry = getEntry(authId, type, { touch: false, body: false });
      if (!currentEntry || !diskEntryExists(key)) {
        return { success: false };
      }

      if (currentEntry.rev !== revBefore) {
        state.shallowFailureCount = 0;
        state.lastShallowError = null;
        persistShallowFailureState(key, state);
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
          lastShallowAttemptAt: state.lastShallowAttemptAt,
          shallowFailureCount: 0,
          lastShallowError: null,
        });

        if (effectiveMultiPage) {
          scheduleBackgroundReconcileIfDue(apiKey, type);
        }
        if (boundaryCrossed) {
          scheduleMutationReconcile(apiKey, type);
        }
      } else if (hasChanges) {
        patchEntry(authId, type, currentEntry, {
          lastShallowPollAt: now,
          isMultiPage: effectiveMultiPage,
          lastShallowAttemptAt: state.lastShallowAttemptAt,
          shallowFailureCount: 0,
          lastShallowError: null,
        });
        if (boundaryCrossed) {
          scheduleMutationReconcile(apiKey, type);
        }
      } else {
        patchEntry(authId, type, currentEntry, {
          lastShallowPollAt: now,
          lastShallowAttemptAt: state.lastShallowAttemptAt,
          shallowFailureCount: 0,
          lastShallowError: null,
        });
      }

      state.shallowFailureCount = 0;
      state.lastShallowError = null;
      return { success: true };
    } catch (error) {
      state.shallowFailureCount = (state.shallowFailureCount || 0) + 1;
      state.lastShallowError = error?.message || 'shallow refresh failed';
      persistShallowFailureState(key, state);
      logReconcileFailure(type, state.lastShallowError, state.shallowFailureCount, 'shallow');
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
  const entry = getEntry(authId, type, { body: false });
  if (!entry) return false;

  const state = getSyncState(key);
  const lastPoll = entry.lastShallowPollAt || 0;
  if (!force && Date.now() - lastPoll < SHALLOW_FRESHNESS_MS) return false;

  const shallowBackoff = effectiveShallowFailureBackoffMs(
    state.shallowFailureCount || 0,
    state.lastShallowError
  );
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

  const key = getCacheKey(authId, type);
  if (!ensureEntryBody(entry, key)) {
    throw new Error('Cache miss after body load');
  }

  if (isValidRev && clientRev < entry.rev) {
    const baseSnapshot = getClientBaseSnapshot(key, clientRev);
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

  if (!entry || isFailedBootstrapEntry(entry)) {
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
  const entry = getEntry(authId, type, { body: false, touch: false });
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
      if (!getEntry(authId, type, { body: false, touch: false })) return;
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
      const entry = getEntry(authId, type, { body: false });
      if (!entry) {
        throw new Error('Cache miss after foreground refresh');
      }
      return serveForClientRev(authId, type, entry, clientRev, isValidRev);
    } catch (error) {
      const entry = getEntry(authId, type, { body: false });
      if (entry) {
        return serveForClientRev(authId, type, entry, clientRev, isValidRev);
      }
      throw error;
    }
  }

  let entry = getEntry(authId, type, { body: false });

  // Failed bootstrap (never synced successfully): honor backoff, then retry.
  // Must not fall through to shallow refresh (would also fail and spam TorBox).
  if (isFailedBootstrapEntry(entry)) {
    const backoff = effectiveReconcileFailureBackoffMs(
      entry.reconcileFailureCount || 0,
      entry.reconcileError
    );
    const attemptAt = entry.lastReconcileAttemptAt || 0;
    if (Date.now() < attemptAt + backoff) {
      throw cachedListSyncError(entry.reconcileError || 'reconcile failed');
    }

    await runFullReconciliation(apiKey, type, { blocking: true });
    entry = getEntry(authId, type);
    if (!entry || isFailedBootstrapEntry(entry)) {
      throw cachedListSyncError(entry?.reconcileError || 'Cache miss after full reconcile');
    }
    return serveSnapshot(entry, { syncMode: 'full' });
  }

  if (!entry) {
    await runFullReconciliation(apiKey, type, { blocking: true });
    entry = getEntry(authId, type);
    if (!entry) {
      throw new Error('Cache miss after full reconcile');
    }
    if (isFailedBootstrapEntry(entry)) {
      throw cachedListSyncError(entry.reconcileError || 'reconcile failed');
    }
    return serveSnapshot(entry, { syncMode: 'full' });
  }

  await ensureShallowRefreshIfStale(apiKey, type, { force: forceListSync });

  entry = getEntry(authId, type, { body: false });
  if (!entry) {
    throw new Error('Cache miss after shallow refresh');
  }
  if (isFailedBootstrapEntry(entry)) {
    throw cachedListSyncError(entry.reconcileError || 'reconcile failed');
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

  wipeDiskCacheDir(getDiskCacheDir());
  syncStateByKey.clear();
  diskCacheDirOverride = null;
  diskDirEnsured = null;
}

/**
 * @param {string} dir
 */
function wipeDiskCacheDir(dir) {
  try {
    if (!fs.existsSync(dir)) return;
    const names = fs.readdirSync(dir);
    for (const name of names) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** @internal test helper */
export function getDownloadListSyncCacheEntry(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const entry = getEntry(authId, type, { touch: false });
  if (!entry) return null;
  return {
    data: getEntryData(entry),
    rev: entry.rev,
    reconcileState: entry.reconcileState,
    reconcileError: entry.reconcileError,
    lastFullReconcileAt: entry.lastFullReconcileAt,
    lastShallowPollAt: entry.lastShallowPollAt,
    lastReconcileAttemptAt: entry.lastReconcileAttemptAt,
    isMultiPage: entry.isMultiPage,
    reconcileFailureCount: entry.reconcileFailureCount ?? 0,
  };
}

/** @internal test helper — disk-only catalog storage (no in-memory gzip). */
export function getDownloadListSyncLiveStorageForTests(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const { metaPath, bodyPath } = diskPathsForKey(key);
  const onDisk = fs.existsSync(metaPath) && fs.existsSync(bodyPath);
  let hasCompressedBody = false;
  if (onDisk) {
    try {
      const body = fs.readFileSync(bodyPath);
      hasCompressedBody = Buffer.isBuffer(body) && body.length > 0;
    } catch {
      hasCompressedBody = false;
    }
  }
  return {
    inMemory: false,
    onDisk,
    hasCompressedBody,
    hasUncompressedData: false,
  };
}

/** @internal test helper — whether sync coordination state exists for a key. */
export function hasDownloadListSyncStateForTests(apiKey, type) {
  const authId = hashApiKey(apiKey);
  return syncStateByKey.has(getCacheKey(authId, type));
}

/** @internal test helper — gzip-only rev archives on disk (no uncompressed data). */
export function getDownloadListSyncRevHistoryForTests(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const dir = getDiskCacheDir();
  const { stem } = diskPathsForKey(key);
  const prefix = `${stem}.rev.`;
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!name.startsWith(prefix) || !name.endsWith('.gz')) continue;
    const rev = Number(name.slice(prefix.length, -'.gz'.length));
    if (!Number.isInteger(rev)) continue;
    let hasCompressedBody = false;
    try {
      const body = fs.readFileSync(path.join(dir, name));
      hasCompressedBody = Buffer.isBuffer(body) && body.length > 0;
    } catch {
      hasCompressedBody = false;
    }
    out.push({ rev, hasCompressedBody, hasUncompressedData: false });
  }
  return out.sort((a, b) => a.rev - b.rev);
}

/** @internal test helper */
export function setDownloadListSyncCacheMetaForTests(apiKey, type, meta) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const entry = readDiskEntry(key);
  if (!entry) return;
  Object.assign(entry, meta);
  // Preserve gzip body; meta-only fields may include lastAccess for TTL tests.
  if (!writeDiskEntry(key, entry)) {
    throw new Error('test meta write failed');
  }
}

/** @internal test helper */
export function setDownloadListSyncDiskOptionsForTests({ dir = null } = {}) {
  diskCacheDirOverride = dir;
  diskDirEnsured = null;
}

/** @internal test helper */
export async function flushMutationReconcileTimerForTests(apiKey, type) {
  const authId = hashApiKey(apiKey);
  const key = getCacheKey(authId, type);
  const timer = mutationReconcileTimers.get(key);
  if (!timer) return;
  clearTimeout(timer);
  mutationReconcileTimers.delete(key);
  if (!getEntry(authId, type, { touch: false })) return;
  await runFullReconciliation(apiKey, type, { blocking: false });
}

/** @internal test helper — wipe disk catalogs without clearing disk-dir override. */
export function clearDownloadListSyncCacheOnlyForTests() {
  wipeDiskCacheDir(getDiskCacheDir());
  syncStateByKey.clear();
}

/** @internal test helper — drop process coordination while leaving disk snapshots. */
export function clearDownloadListSyncCoordinationForTests() {
  for (const timer of mutationReconcileTimers.values()) {
    clearTimeout(timer);
  }
  mutationReconcileTimers.clear();
  syncStateByKey.clear();
}

/** @internal test helper */
export function evictExpiredDiskEntriesForTests() {
  evictExpiredDiskEntries();
}

/** @internal test helper — exported for unit tests */
export {
  reconcileFailureBackoffMs,
  effectiveReconcileFailureBackoffMs,
  effectiveShallowFailureBackoffMs,
  isFailedBootstrapEntry,
  shallowFailureBackoffMs,
  runShallowRefresh,
  ensureShallowRefreshIfStale,
  CACHE_TTL_MS,
  REV_HISTORY_LIMIT,
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
