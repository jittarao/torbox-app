import logger from '../utils/logger.js';

/** Max action batches run in parallel (each batch uses RULE_ACTION_CONCURRENCY API calls) */
const GLOBAL_ACTION_QUEUE_CONCURRENCY = Math.min(
  8,
  Math.max(1, parseInt(process.env.GLOBAL_ACTION_QUEUE_CONCURRENCY || '4', 10))
);
const MAX_ACTION_BATCH_RETRIES = Math.max(1, parseInt(process.env.MAX_ACTION_BATCH_RETRIES || '3', 10));
const ACTION_RETRY_BACKOFF_BASE_MS = 5000;

/**
 * Cross-user action queue: drains pending rule actions in the background so the next tick's
 * fetch phase is not blocked. Uses ApiClient's action semaphore internally when executing.
 */
class GlobalActionQueue {
  constructor(scheduler) {
    this.scheduler = scheduler;
    this.pending = [];
    this.draining = false;
  }

  enqueue(descriptors) {
    if (!Array.isArray(descriptors) || descriptors.length === 0) return;
    const masterDb = this.scheduler.masterDb;
    for (const d of descriptors) {
      if (masterDb && masterDb.insertPendingAction) {
        try {
          const payload = JSON.stringify({
            authId: d.authId,
            rule: d.rule,
            torrentsToProcess: d.torrentsToProcess,
          });
          const ruleId = d.rule?.id ?? null;
          const id = masterDb.insertPendingAction(d.authId, payload, ruleId);
          d.pendingId = id;
          this.pending.push(d);
        } catch (err) {
          logger.warn('Failed to persist pending action', { authId: d.authId, errorMessage: err.message });
        }
      } else {
        this.pending.push(d);
      }
    }
    this.drain().catch((err) => {
      logger.error('GlobalActionQueue drain error', err, {
        errorMessage: err.message,
        pendingCount: this.pending.length,
      });
    });
  }

  /**
   * Load persisted pending actions (e.g. after restart) and drain.
   * All rows are loaded; drain merges by (authId, rule_id) and deduplicates by torrent ID.
   */
  async loadFromPersistence() {
    const masterDb = this.scheduler.masterDb;
    if (!masterDb || !masterDb.getAllPendingActions) return;
    try {
      const rows = masterDb.getAllPendingActions();
      for (const row of rows) {
        try {
          const d = JSON.parse(row.payload);
          d.pendingId = row.id;
          this.pending.push(d);
        } catch (err) {
          logger.warn('Failed to parse pending action, removing', { id: row.id, errorMessage: err.message });
          masterDb.deletePendingAction(row.id);
        }
      }
      if (this.pending.length > 0) {
        logger.info('Resumed pending actions from DB', { count: this.pending.length });
        await this.drain();
      }
    } catch (err) {
      logger.error('Failed to load pending actions from DB', err, { errorMessage: err.message });
    }
  }

  /**
   * Merge descriptors for the same (authId, rule.id): union of torrentsToProcess by torrent id.
   * Returns one merged descriptor and array of pendingIds to delete after execution.
   * Supports both single pendingId and pendingIds array (e.g. re-queued merged batch).
   */
  _mergeBatchForSameRule(pendingList) {
    if (pendingList.length === 0) return null;
    const first = pendingList[0];
    const byId = new Map();
    const pendingIds = [];
    let retryCount = first.retryCount ?? 0;
    for (const d of pendingList) {
      if (d.pendingIds && Array.isArray(d.pendingIds)) {
        pendingIds.push(...d.pendingIds);
      } else if (d.pendingId != null) {
        pendingIds.push(d.pendingId);
      }
      if (d.retryCount != null && d.retryCount > retryCount) retryCount = d.retryCount;
      for (const t of d.torrentsToProcess || []) {
        const id = t?.id ?? t?.torrent_id ?? t?.usenet_id ?? t?.web_id;
        if (id != null && !byId.has(id)) byId.set(id, t);
      }
    }
    return {
      merged: {
        authId: first.authId,
        rule: first.rule,
        torrentsToProcess: Array.from(byId.values()),
        retryCount,
      },
      pendingIds,
    };
  }

  async drain() {
    if (this.draining || this.pending.length === 0) return;
    this.draining = true;
    const masterDb = this.scheduler.masterDb;

    // Partition by (authId, ruleId) so all same-rule items are merged regardless of order
    const groups = new Map();
    for (const item of this.pending) {
      const k = `${item.authId}:${item.rule?.id ?? 'null'}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(item);
    }
    this.pending = [];
    const batchQueue = Array.from(groups.values());

    try {
      const concurrency = GLOBAL_ACTION_QUEUE_CONCURRENCY;
      const worker = async () => {
        while (batchQueue.length > 0) {
          const sameRule = batchQueue.shift();
          if (!sameRule?.length) continue;
          const { merged, pendingIds } = this._mergeBatchForSameRule(sameRule);
          if (!merged || merged.torrentsToProcess.length === 0) {
            for (const id of pendingIds) {
              if (masterDb?.deletePendingAction) try { masterDb.deletePendingAction(id); } catch (_) {}
            }
            continue;
          }
          try {
            await this.scheduler.runActionBatch(merged);
            for (const id of pendingIds) {
              if (masterDb?.deletePendingAction) try { masterDb.deletePendingAction(id); } catch (_) {}
            }
          } catch (err) {
            const retryCount = (merged.retryCount ?? 0) + 1;
            if (retryCount > MAX_ACTION_BATCH_RETRIES) {
              logger.error('GlobalActionQueue action batch failed after max retries, dropping', err, {
                errorMessage: err.message,
                authId: merged.authId,
                ruleId: merged.rule?.id,
                ruleName: merged.rule?.name,
                retryCount,
              });
              for (const id of pendingIds) {
                if (masterDb?.deletePendingAction) try { masterDb.deletePendingAction(id); } catch (_) {}
              }
            } else {
              const backoffMs = ACTION_RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount - 1);
              logger.warn('GlobalActionQueue action batch failed, will retry', {
                errorMessage: err.message,
                authId: merged.authId,
                ruleId: merged.rule?.id,
                retryCount,
                nextRetryInMs: backoffMs,
              });
              this.pending.push({
                authId: merged.authId,
                rule: merged.rule,
                torrentsToProcess: merged.torrentsToProcess,
                pendingIds,
                retryCount,
              });
              setTimeout(() => {
                this.drain().catch((e) => {
                  logger.error('GlobalActionQueue drain error on retry', e, {
                    errorMessage: e.message,
                    pendingCount: this.pending.length,
                  });
                });
              }, backoffMs);
            }
          }
        }
      };
      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);
    } finally {
      this.draining = false;
      // Re-drain if items arrived while draining (avoids items stuck until next enqueue)
      if (this.pending.length > 0) {
        this.drain().catch((err) => {
          logger.error('GlobalActionQueue drain error', err, {
            errorMessage: err.message,
            pendingCount: this.pending.length,
          });
        });
      }
    }
  }
}

export default GlobalActionQueue;
