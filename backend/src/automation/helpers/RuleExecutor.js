import logger from '../../utils/logger.js';

/**
 * Executor for rule actions
 */
class RuleExecutor {
  constructor(authId, getRuleEvaluator) {
    this.authId = authId;
    this.getRuleEvaluator = getRuleEvaluator;
  }

  /**
   * Execute actions on a list of torrents
   * @param {Object} rule - Rule configuration
   * @param {Array} torrents - Torrents to process
   * @returns {Promise<Object>} - { successCount, errorCount }
   */
  async executeActions(rule, torrents) {
    let successCount = 0;
    let errorCount = 0;

    // Resolve the evaluator once outside the loop to avoid N async pool lookups per rule execution
    const ruleEvaluator = await this.getRuleEvaluator();

    for (const torrent of torrents) {
      try {
        logger.debug('Executing action on torrent', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          action: rule.action?.type,
          torrentStatus: ruleEvaluator.getTorrentStatus(torrent),
        });

        await ruleEvaluator.executeAction(rule.action, torrent);
        successCount++;

        logger.debug('Action successfully executed', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          action: rule.action?.type,
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

    return { successCount, errorCount };
  }
}

export default RuleExecutor;
