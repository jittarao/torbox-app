import logger from '../utils/logger.js';
import torboxApiOutageCoordinator from '../api/TorboxApiOutageCoordinator.js';
import {
  computeAutomationInactivityCutoff,
  INACTIVITY_RECHECK_INTERVAL_MS,
  isUserEligibleForAutomation,
} from '../config/automationInactivity.js';

/** Max action batches run in parallel (each batch uses RULE_ACTION_CONCURRENCY API calls) */
const GLOBAL_ACTION_QUEUE_CONCURRENCY = Math.min(
  8,
  Math.max(1, parseInt(process.env.GLOBAL_ACTION_QUEUE_CONCURRENCY || '4', 10))
);
const MAX_ACTION_BATCH_RETRIES = Math.max(
  1,
  parseInt(process.env.MAX_ACTION_BATCH_RETRIES || '3', 10)
);
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
    if (masterDb && masterDb.batchInsertPendingActions) {
      const batch = [];
      for (const d of descriptors) {
        const payload = JSON.stringify({
          authId: d.authId,
          rule: d.rule,
          torrentsToProcess: d.torrentsToProcess,
        });
        const ruleId = d.rule?.id ?? null;
        batch.push({ authId: d.authId, payload, ruleId });
      }
      try {
        const ids = masterDb.batchInsertPendingActions(batch);
        for (let i = 0; i < descriptors.length; i++) {
          descriptors[i].pendingId = ids[i];
          this.pending.push(descriptors[i]);
        }
      } catch (err) {
        logger.warn('Failed to persist pending action batch', {
          count: descriptors.length,
          errorMessage: err.message,
        });
        for (const d of descriptors) {
          this.pending.push(d);
        }
      }
    } else {
      for (const d of descriptors) {
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
          logger.warn('Failed to parse pending action, removing', {
            id: row.id,
            errorMessage: err.message,
          });
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
   * Split pending into items ready now vs items waiting on retry backoff (_deferDrainUntil).
   * Leaves deferred items on this.pending; returns ready items to process in this drain pass.
   * @returns {Array}
   * @private
   */
  _takeReadyPending() {
    const now = Date.now();
    const ready = [];
    const deferred = [];
    for (const item of this.pending) {
      if (typeof item._deferDrainUntil === 'number' && item._deferDrainUntil > now) {
        deferred.push(item);
      } else {
        ready.push(item);
      }
    }
    this.pending = deferred;
    return ready;
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
    let deferUntil = null;
    for (const d of pendingList) {
      if (d.pendingIds && Array.isArray(d.pendingIds)) {
        pendingIds.push(...d.pendingIds);
      } else if (d.pendingId != null) {
        pendingIds.push(d.pendingId);
      }
      if (d.retryCount != null && d.retryCount > retryCount) retryCount = d.retryCount;
      if (typeof d._deferDrainUntil === 'number') {
        if (deferUntil == null || d._deferDrainUntil > deferUntil) {
          deferUntil = d._deferDrainUntil;
        }
      }
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
        _deferDrainUntil: deferUntil,
      },
      pendingIds,
    };
  }

  async drain() {
    if (!torboxApiOutageCoordinator.isAutomationAllowed()) {
      return;
    }

    const ready = this._takeReadyPending();
    if (ready.length === 0) return;

    if (this.draining) {
      this.pending = [...ready, ...this.pending];
      return;
    }

    this.draining = true;
    const masterDb = this.scheduler.masterDb;
    const inactivityCutoff = computeAutomationInactivityCutoff();

    // Partition by (authId, ruleId) so all same-rule items are merged regardless of order
    const groups = new Map();
    for (const item of ready) {
      const k = `${item.authId}:${item.rule?.id ?? 'null'}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(item);
    }
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
              if (masterDb?.deletePendingAction)
                try {
                  masterDb.deletePendingAction(id);
                } catch (_) {}
            }
            continue;
          }

          if (inactivityCutoff) {
            const userInfo = masterDb?.getUserRegistryInfo?.(merged.authId);
            if (!isUserEligibleForAutomation(userInfo?.last_seen_at, inactivityCutoff)) {
              const deferUntil = Date.now() + INACTIVITY_RECHECK_INTERVAL_MS;
              for (const item of sameRule) {
                item._deferDrainUntil = deferUntil;
              }
              this.pending.push(...sameRule);
              this.scheduler.recordInactivitySkip?.('queue');
              continue;
            }
          }

          // At-most-once: delete DB rows before execution so a crash does not replay the action
          for (const id of pendingIds) {
            if (masterDb?.deletePendingAction)
              try {
                masterDb.deletePendingAction(id);
              } catch (_) {}
          }

          try {
            await this.scheduler.runActionBatch(merged);
          } catch (err) {
            const retryCount = (merged.retryCount ?? 0) + 1;
            if (retryCount > MAX_ACTION_BATCH_RETRIES) {
              logger.error(
                'GlobalActionQueue action batch failed after max retries, dropping',
                err,
                {
                  errorMessage: err.message,
                  authId: merged.authId,
                  ruleId: merged.rule?.id,
                  ruleName: merged.rule?.name,
                  retryCount,
                }
              );
            } else {
              const backoffMs = ACTION_RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount - 1);
              const deferUntil = Date.now() + backoffMs;
              logger.warn('GlobalActionQueue action batch failed, will retry', {
                errorMessage: err.message,
                authId: merged.authId,
                ruleId: merged.rule?.id,
                retryCount,
                nextRetryInMs: backoffMs,
              });

              // Re-persist to DB so the action survives a crash between retry attempts
              const reinsertPayload = JSON.stringify({
                authId: merged.authId,
                rule: merged.rule,
                torrentsToProcess: merged.torrentsToProcess,
              });
              const ruleId = merged.rule?.id ?? null;
              let newPendingIds = [];
              if (masterDb?.insertPendingAction) {
                try {
                  const newId = masterDb.insertPendingAction(
                    merged.authId,
                    reinsertPayload,
                    ruleId
                  );
                  if (newId != null && newId > 0) newPendingIds = [newId];
                } catch (_) {}
              }

              this.pending.push({
                authId: merged.authId,
                rule: merged.rule,
                torrentsToProcess: merged.torrentsToProcess,
                pendingIds: newPendingIds,
                retryCount,
                _deferDrainUntil: deferUntil,
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
      // New work may have arrived during drain (enqueue). Only re-drain items that are ready
      // now — never pull items still under _deferDrainUntil (retry backoff).
      const now = Date.now();
      const readyTail = [];
      const stillDeferred = [];
      for (const item of this.pending) {
        if (typeof item._deferDrainUntil === 'number' && item._deferDrainUntil > now) {
          stillDeferred.push(item);
        } else {
          readyTail.push(item);
        }
      }
      this.pending = stillDeferred;
      if (readyTail.length > 0) {
        this.pending = [...readyTail, ...this.pending];
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
