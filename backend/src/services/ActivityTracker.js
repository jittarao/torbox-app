import logger from '../utils/logger.js';

/** In-memory online window (2 minutes). */
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

/** Minimum interval between SQLite persists per user (5 minutes). */
export const PERSIST_INTERVAL_MS = 5 * 60 * 1000;

/** Background flush interval for batched writes. */
export const FLUSH_INTERVAL_MS = 30 * 1000;

/**
 * Centralized user activity tracker with in-memory debounce and batched persistence.
 *
 * - Every beacon updates memory immediately (cheap).
 * - SQLite writes occur at most once per user per PERSIST_INTERVAL_MS.
 * - Online status is derived from in-memory touches within ONLINE_WINDOW_MS.
 */
export default class ActivityTracker {
  /**
   * @param {import('../database/Database.js').default} masterDatabase
   * @param {{ persistIntervalMs?: number, onlineWindowMs?: number, flushIntervalMs?: number }} [options]
   */
  constructor(masterDatabase, options = {}) {
    this.masterDatabase = masterDatabase;
    this.persistIntervalMs = options.persistIntervalMs ?? PERSIST_INTERVAL_MS;
    this.onlineWindowMs = options.onlineWindowMs ?? ONLINE_WINDOW_MS;
    this.flushIntervalMs = options.flushIntervalMs ?? FLUSH_INTERVAL_MS;

    /** @type {Map<string, { touchedAt: number, lastPersistedAt: number | null }>} */
    this._memory = new Map();
    /** @type {Map<string, number>} authId -> touchedAt ms for pending flush */
    this._pending = new Map();
    this._flushTimerId = null;
  }

  start() {
    if (this._flushTimerId != null) return;
    this._flushTimerId = setInterval(() => {
      try {
        this.pruneStaleMemory();
        this.flush();
      } catch (error) {
        logger.warn('ActivityTracker periodic flush failed', { error: error.message });
      }
    }, this.flushIntervalMs);
    if (typeof this._flushTimerId.unref === 'function') {
      this._flushTimerId.unref();
    }
  }

  stop() {
    if (this._flushTimerId != null) {
      clearInterval(this._flushTimerId);
      this._flushTimerId = null;
    }
  }

  /**
   * Record user activity from a beacon or authenticated request.
   * @param {string} authId
   * @param {Date} [at]
   */
  touch(authId, at = new Date()) {
    if (!authId) return;

    const touchedAt = at.getTime();
    const existing = this._memory.get(authId);
    const lastPersistedAt = existing?.lastPersistedAt ?? null;

    this._memory.set(authId, { touchedAt, lastPersistedAt });

    const shouldPersist =
      lastPersistedAt == null || touchedAt - lastPersistedAt >= this.persistIntervalMs;

    if (shouldPersist) {
      this._pending.set(authId, touchedAt);
    }
  }

  /**
   * Flush pending activity writes to SQLite.
   */
  flush() {
    if (this._pending.size === 0) return;

    const entries = Array.from(this._pending.entries()).map(([authId, touchedAt]) => ({
      authId,
      at: new Date(touchedAt),
    }));

    try {
      this.masterDatabase.touchUserActivityBatch(entries);
    } catch (error) {
      logger.warn('ActivityTracker flush failed; pending entries retained for retry', {
        error: error.message,
        count: entries.length,
      });
      throw error;
    }

    const flushedAt = Date.now();
    for (const { authId, at } of entries) {
      this._pending.delete(authId);
      const mem = this._memory.get(authId);
      if (mem) {
        mem.lastPersistedAt = at.getTime();
      } else {
        this._memory.set(authId, { touchedAt: at.getTime(), lastPersistedAt: at.getTime() });
      }
    }

    logger.debug('ActivityTracker flushed user activity', {
      count: entries.length,
      flushedAt,
    });
  }

  /**
   * @param {string} authId
   * @returns {boolean}
   */
  isOnline(authId) {
    const entry = this._memory.get(authId);
    if (!entry) return false;
    return Date.now() - entry.touchedAt < this.onlineWindowMs;
  }

  /**
   * @returns {number}
   */
  getOnlineCount() {
    return this.getOnlineAuthIds().length;
  }

  /**
   * @returns {string[]}
   */
  getOnlineAuthIds() {
    const now = Date.now();
    const online = [];
    for (const [authId, entry] of this._memory) {
      if (now - entry.touchedAt < this.onlineWindowMs) {
        online.push(authId);
      }
    }
    return online;
  }

  /**
   * Prune stale in-memory entries (older than 24h) to bound memory.
   */
  pruneStaleMemory(maxAgeMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    for (const [authId, entry] of this._memory) {
      if (entry.touchedAt < cutoff) {
        this._memory.delete(authId);
      }
    }
  }
}
