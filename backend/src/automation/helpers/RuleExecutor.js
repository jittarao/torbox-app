import logger from '../../utils/logger.js';
import {
  isDestructiveOperation,
  PROTECTION_SKIP_REASON,
} from '../../config/destructiveDownloadOperations.mjs';
import { isActiveDownloadLimitError } from '../../api/ApiClient.js';

/**
 * Executor for rule actions
 */
class RuleExecutor {
  constructor(authId, getRuleEvaluator) {
    this.authId = authId;
    this.getRuleEvaluator = getRuleEvaluator;
  }

  /**
   * Execute actions on a list of torrents with bounded concurrency.
   *
   * Previously actions ran serially: N matched torrents × 30s axios timeout = N×30s, which
   * easily exhausted the 180s per-user poll budget for rules that match many torrents.
   * Running up to RULE_ACTION_CONCURRENCY actions in parallel collapses that to
   * ceil(N / concurrency) × 30s, giving the poll enough headroom to complete.
   *
   * @param {Object} rule - Rule configuration
   * @param {Array} torrents - Torrents to process
   * @returns {Promise<Object>} - { successCount, errorCount, protectedSkippedCount, abortedCount }
   */
  async executeActions(rule, torrents) {
    let successCount = 0;
    let errorCount = 0;
    let protectedSkippedCount = 0;
    let abortedCount = 0;

    // Resolve the evaluator once outside the loop to avoid N async pool lookups per rule execution
    const ruleEvaluator = await this.getRuleEvaluator();

    // For tag actions, validate tag IDs once before starting the worker pool; pass skipValidation so handlers don't re-validate.
    const tagActionValidated =
      (rule.action?.type === 'add_tag' || rule.action?.type === 'remove_tag') &&
      Array.isArray(rule.action?.tagIds) &&
      rule.action.tagIds.length > 0;
    if (tagActionValidated) {
      ruleEvaluator.validateTagIds(rule.action.tagIds);
    }

    const actionType = rule.action?.type;
    let protectedSet = null;
    if (isDestructiveOperation(actionType)) {
      const downloadIds = torrents.flatMap((torrent) => {
        const id = ruleEvaluator.extractDownloadId(torrent);
        return id ? [id] : [];
      });
      protectedSet = ruleEvaluator.protectionService.getProtectedSet(downloadIds);
    }

    // Cap concurrent outbound action calls per rule.
    // force_start aborts the whole batch on active-download-limit — run serially so we
    // don't fire multiple TorBox POSTs before abortRemaining settles.
    // Other actions use RULE_ACTION_CONCURRENCY (default 3).
    const defaultConcurrency = Math.max(
      1,
      parseInt(process.env.RULE_ACTION_CONCURRENCY || '3', 10)
    );
    const concurrency = actionType === 'force_start' ? 1 : defaultConcurrency;

    // Worker-pool: each worker drains the shared queue until empty.
    // Node.js is single-threaded so queue.shift() and counter mutations are safe across workers.
    const queue = [...torrents];
    let abortRemaining = false;
    let abortReason = null;

    const discardRemaining = () => {
      const remaining = queue.splice(0, queue.length);
      abortedCount += remaining.length;
    };

    const worker = async () => {
      while (queue.length > 0) {
        if (abortRemaining) {
          discardRemaining();
          return;
        }

        const torrent = queue.shift();
        if (!torrent) continue;

        // Re-check after dequeue — another worker may have aborted while we waited.
        if (abortRemaining) {
          abortedCount++;
          continue;
        }

        try {
          const action = rule.action;
          const currentActionType = action?.type;
          logger.debug('Executing action on torrent', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            action: currentActionType,
            torrentStatus: ruleEvaluator.getTorrentStatus(torrent),
          });

          // Final abort check immediately before the outbound TorBox call.
          if (abortRemaining) {
            abortedCount++;
            continue;
          }

          const result = await ruleEvaluator.executeAction(action, torrent, {
            skipValidation: tagActionValidated,
            protectedSet,
          });

          if (result?.skipped === true && result?.reason === PROTECTION_SKIP_REASON) {
            protectedSkippedCount++;
            logger.info('Action skipped — download is protected', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              torrentId: torrent.id,
              torrentName: torrent.name,
              action: currentActionType,
            });
            continue;
          }

          if (result?.applied === false) {
            logger.debug('Action skipped — no change (already applied)', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              torrentId: torrent.id,
              torrentName: torrent.name,
              action: currentActionType,
            });
            continue;
          }

          // Soft connection fallback returns { success: false, isConnectionError: true }
          // — must not count as a successful action.
          if (result?.success === false || result?.isConnectionError === true) {
            errorCount++;
            logger.debug('Action soft-failed (connection/API fallback)', {
              authId: this.authId,
              ruleId: rule.id,
              ruleName: rule.name,
              torrentId: torrent.id,
              action: currentActionType,
              error: result?.error,
              message: result?.message,
            });
            continue;
          }

          successCount++;

          logger.debug('Action successfully executed', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            action: currentActionType,
          });
        } catch (error) {
          // Active download limit: further force_starts in this batch cannot succeed.
          if (actionType === 'force_start' && isActiveDownloadLimitError(error)) {
            if (!abortRemaining) {
              abortRemaining = true;
              abortReason = error.message || 'Active download limit reached';
              errorCount++;
              discardRemaining();
              logger.warn(
                'Active download limit reached — aborting remaining force_start actions',
                {
                  authId: this.authId,
                  ruleId: rule.id,
                  ruleName: rule.name,
                  torrentId: torrent.id,
                  abortedRemaining: abortedCount,
                  message: abortReason,
                }
              );
            }
            // In-flight siblings that also hit the limit: skip without extra logs/counts.
            continue;
          }

          let torrentStatus = 'unknown';
          try {
            torrentStatus = ruleEvaluator.getTorrentStatus(torrent);
          } catch (_) {
            // Status unavailable — log without it
          }

          logger.error('Action failed for torrent', error, {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            torrentStatus,
            action: rule.action?.type,
          });
          errorCount++;
        }
      }
    };

    const workerCount = Math.min(concurrency, torrents.length);
    await Promise.all(Array.from({ length: workerCount }, worker));

    return { successCount, errorCount, protectedSkippedCount, abortedCount };
  }
}

export default RuleExecutor;
