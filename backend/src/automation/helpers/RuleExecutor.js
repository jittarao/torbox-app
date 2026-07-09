import logger from '../../utils/logger.js';
import {
  isDestructiveOperation,
  PROTECTION_SKIP_REASON,
} from '../../config/destructiveDownloadOperations.mjs';

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
   * @returns {Promise<Object>} - { successCount, errorCount }
   */
  async executeActions(rule, torrents) {
    let successCount = 0;
    let errorCount = 0;
    let protectedSkippedCount = 0;

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
      const downloadIds = torrents
        .map((torrent) => ruleEvaluator.extractDownloadId(torrent))
        .filter(Boolean);
      protectedSet = ruleEvaluator.protectionService.getProtectedSet(downloadIds);
    }

    // Cap concurrent outbound action calls per rule.
    // low while cutting worst-case wall-clock time from N×30s (serial) to ceil(N/3)×30s.
    // Configurable via RULE_ACTION_CONCURRENCY env var.
    const concurrency = Math.max(1, parseInt(process.env.RULE_ACTION_CONCURRENCY || '3', 10));

    // Worker-pool: each worker drains the shared queue until empty.
    // Node.js is single-threaded so queue.shift() and counter mutations are safe across workers.
    const queue = [...torrents];

    const worker = async () => {
      while (queue.length > 0) {
        const torrent = queue.shift();
        if (!torrent) continue;

        try {
          const action = rule.action;
          const actionType = action?.type;
          logger.debug('Executing action on torrent', {
            authId: this.authId,
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            action: actionType,
            torrentStatus: ruleEvaluator.getTorrentStatus(torrent),
          });

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
              action: actionType,
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
              action: actionType,
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
            action: actionType,
          });
        } catch (error) {
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

    return { successCount, errorCount, protectedSkippedCount };
  }
}

export default RuleExecutor;
