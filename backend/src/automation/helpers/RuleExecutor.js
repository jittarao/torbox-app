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

    for (const torrent of torrents) {
      try {
        const ruleEvaluator = await this.getRuleEvaluator();
        logger.verbose('Executing action on torrent', {
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

        logger.verbose('Action successfully executed', {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          action: rule.action?.type,
        });
      } catch (error) {
        // Safely get torrent status for logging, handle errors gracefully
        let torrentStatus = 'unknown';
        try {
          const ruleEvaluator = await this.getRuleEvaluator();
          torrentStatus = ruleEvaluator.getTorrentStatus(torrent);
        } catch (statusError) {
          // If we can't get status, just log without it
          logger.verbose('Could not get torrent status for error logging', {
            authId: this.authId,
            torrentId: torrent.id,
            statusError: statusError.message,
          });
        }

        logger.error('Action failed for torrent', error, {
          authId: this.authId,
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          torrentStatus: torrentStatus,
          action: rule.action?.type,
        });
        errorCount++;
      }
    }

    return { successCount, errorCount };
  }
}

export default RuleExecutor;
