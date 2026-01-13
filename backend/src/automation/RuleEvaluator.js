import { getTorrentStatus as getTorrentStatusUtil } from '../utils/torrentStatus.js';
import logger from '../utils/logger.js';
import { applyIntervalMultiplier } from '../utils/intervalUtils.js';

// Constants
const MIN_INTERVAL_MINUTES = 1;
const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;
const BYTES_PER_MB = 1024 * 1024;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_AVG_SPEED_HOURS = 1;
const SPEED_HISTORY_BUFFER_MULTIPLIER = 1.5;

/**
 * Rule Evaluator
 * Evaluates automation rules with support for derived fields
 */
class RuleEvaluator {
  constructor(userDb, apiClient) {
    this.db = userDb;
    this.apiClient = apiClient;
  }

  /**
   * Check if rule evaluation should be skipped due to interval constraints
   * @param {Object} rule - Rule configuration
   * @returns {boolean} - True if evaluation should be skipped
   */
  shouldSkipEvaluation(rule) {
    if (!rule.trigger || rule.trigger.type !== 'interval' || !rule.trigger.value) {
      return false; // No interval trigger, evaluate on every poll
    }

    const intervalMinutes = rule.trigger.value;

    if (intervalMinutes < MIN_INTERVAL_MINUTES) {
      logger.warn('Rule has invalid interval (less than 1 minute), using 1 minute minimum', {
        ruleId: rule.id,
        ruleName: rule.name,
        intervalMinutes,
      });
    }

    if (!rule.last_evaluated_at) {
      logger.debug('Rule has no last_evaluated_at, evaluating immediately', {
        ruleId: rule.id,
        ruleName: rule.name,
        intervalMinutes,
      });
      return false; // Never evaluated, evaluate immediately
    }

    const lastEvaluated = new Date(rule.last_evaluated_at);
    const adjustedIntervalMinutes = applyIntervalMultiplier(
      Math.max(intervalMinutes, MIN_INTERVAL_MINUTES)
    );
    const intervalMs = adjustedIntervalMinutes * MS_PER_MINUTE;
    const timeSinceLastEvaluation = Date.now() - lastEvaluated.getTime();

    if (timeSinceLastEvaluation < intervalMs) {
      const remainingMs = intervalMs - timeSinceLastEvaluation;
      const remainingMinutes = (remainingMs / MS_PER_MINUTE).toFixed(2);
      logger.debug('Rule evaluation skipped - interval not elapsed', {
        ruleId: rule.id,
        ruleName: rule.name,
        intervalMinutes,
        lastEvaluatedAt: rule.last_evaluated_at,
        timeSinceLastEvaluation: `${(timeSinceLastEvaluation / MS_PER_MINUTE).toFixed(2)} minutes`,
        remainingMinutes: `${remainingMinutes} minutes`,
        nextEvaluationIn: `${remainingMinutes} minutes`,
      });
      return true;
    }

    logger.debug('Rule interval elapsed, proceeding with evaluation', {
      ruleId: rule.id,
      ruleName: rule.name,
      intervalMinutes,
      lastEvaluatedAt: rule.last_evaluated_at,
      timeSinceLastEvaluation: `${(timeSinceLastEvaluation / MS_PER_MINUTE).toFixed(2)} minutes`,
    });

    return false;
  }

  /**
   * Load telemetry data for all torrents in batch
   * @param {Array<string>} torrentIds - Array of torrent IDs
   * @returns {Map} - Map of torrent_id -> telemetry data
   */
  loadTelemetryData(torrentIds) {
    if (torrentIds.length === 0) {
      return new Map();
    }

    const placeholders = torrentIds.map(() => '?').join(',');
    const allTelemetry = this.db
      .prepare(
        `
      SELECT * FROM torrent_telemetry 
      WHERE torrent_id IN (${placeholders})
    `
      )
      .all(...torrentIds);

    return new Map(allTelemetry.map((t) => [String(t.torrent_id), t]));
  }

  /**
   * Load tags data for all downloads if rule has TAGS conditions
   * @param {Object} rule - Rule configuration
   * @param {Array} torrents - Array of torrent objects
   * @returns {Map} - Map of download_id -> array of tags
   */
  loadTagsData(rule, torrents) {
    if (!this.hasTagsCondition(rule) || torrents.length === 0) {
      return new Map();
    }

    const allDownloadIds = new Set();
    for (const torrent of torrents) {
      const downloadId = this.extractDownloadId(torrent);
      if (downloadId) {
        allDownloadIds.add(downloadId);
      }
    }

    if (allDownloadIds.size === 0) {
      return new Map();
    }

    const downloadIdArray = Array.from(allDownloadIds);
    const placeholders = downloadIdArray.map(() => '?').join(',');
    const allDownloadTags = this.db
      .prepare(
        `
      SELECT dt.download_id, t.id, t.name
      FROM download_tags dt
      INNER JOIN tags t ON dt.tag_id = t.id
      WHERE dt.download_id IN (${placeholders})
    `
      )
      .all(...downloadIdArray);

    const tagsByDownloadId = new Map();
    for (const row of allDownloadTags) {
      const downloadId = String(row.download_id);
      if (!tagsByDownloadId.has(downloadId)) {
        tagsByDownloadId.set(downloadId, []);
      }
      tagsByDownloadId.get(downloadId).push({ id: row.id, name: row.name });
    }

    return tagsByDownloadId;
  }

  /**
   * Load speed history data if rule has AVG_SPEED conditions
   * @param {Object} rule - Rule configuration
   * @param {Array<string>} torrentIds - Array of torrent IDs
   * @returns {Map} - Map of torrent_id -> array of speed history samples
   */
  loadSpeedHistoryData(rule, torrentIds) {
    if (!this.hasAvgSpeedCondition(rule) || torrentIds.length === 0) {
      return new Map();
    }

    const maxHours = this.getMaxHoursForAvgSpeed(rule);
    const now = new Date();
    const hoursAgo = new Date(now - maxHours * MS_PER_HOUR);

    const placeholders = torrentIds.map(() => '?').join(',');
    const allSpeedHistory = this.db
      .prepare(
        `
      SELECT * FROM speed_history
      WHERE torrent_id IN (${placeholders}) AND timestamp >= ?
      ORDER BY torrent_id, timestamp ASC
    `
      )
      .all(...torrentIds, hoursAgo.toISOString());

    const speedHistoryMap = new Map();
    for (const sample of allSpeedHistory) {
      const torrentId = String(sample.torrent_id);
      if (!speedHistoryMap.has(torrentId)) {
        speedHistoryMap.set(torrentId, []);
      }
      speedHistoryMap.get(torrentId).push(sample);
    }

    return speedHistoryMap;
  }

  /**
   * Extract download ID from torrent object (supports multiple formats)
   * @param {Object} torrent - Torrent object
   * @returns {string|null} - Download ID or null if not found
   */
  extractDownloadId(torrent) {
    return (
      torrent.id?.toString() ||
      torrent.torrent_id?.toString() ||
      torrent.usenet_id?.toString() ||
      torrent.web_id?.toString() ||
      null
    );
  }

  /**
   * Evaluate a rule against current torrents
   * Supports both old flat structure and new group structure
   * @param {Object} rule - Rule configuration
   * @param {Array} torrents - Current torrents from API
   * @returns {Promise<Array>} - Matching torrents
   */
  async evaluateRule(rule, torrents) {
    if (!rule.enabled) {
      return [];
    }

    if (this.shouldSkipEvaluation(rule)) {
      return [];
    }

    const torrentIds = torrents.map((t) => t.id).filter((id) => id != null);
    const telemetryMap = this.loadTelemetryData(torrentIds);
    const tagsByDownloadId = this.loadTagsData(rule, torrents);
    const speedHistoryMap = this.loadSpeedHistoryData(rule, torrentIds);

    const hasGroups = rule.groups && Array.isArray(rule.groups) && rule.groups.length > 0;

    logger.debug('Evaluating rule against torrents', {
      ruleId: rule.id,
      ruleName: rule.name,
      hasGroups,
      torrentCount: torrents.length,
      groupCount: hasGroups ? rule.groups.length : 0,
    });

    const matchingTorrents = hasGroups
      ? this.evaluateGroupStructure(rule, torrents, telemetryMap, tagsByDownloadId, speedHistoryMap)
      : this.evaluateFlatStructure(rule, torrents, telemetryMap, tagsByDownloadId, speedHistoryMap);

    logger.info('Rule evaluation completed', {
      ruleId: rule.id,
      ruleName: rule.name,
      torrentCount: torrents.length,
      matchedCount: matchingTorrents.length,
      matchedIds: matchingTorrents.map((t) => t.id),
      structure: hasGroups ? 'group' : 'flat',
    });

    return matchingTorrents;
  }

  /**
   * Evaluate rule with group structure
   * @param {Object} rule - Rule configuration with groups
   * @param {Array} torrents - Array of torrent objects
   * @param {Map} telemetryMap - Pre-loaded telemetry data
   * @param {Map} tagsByDownloadId - Pre-loaded tags data
   * @param {Map} speedHistoryMap - Pre-loaded speed history data
   * @returns {Array} - Matching torrents
   */
  evaluateGroupStructure(rule, torrents, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const groupLogicOperator = rule.logicOperator || 'and';

    return torrents.filter((torrent) => {
      const groupResults = rule.groups.map((group, groupIndex) => {
        return this.evaluateGroup(
          group,
          groupIndex,
          torrent,
          rule,
          telemetryMap,
          tagsByDownloadId,
          speedHistoryMap
        );
      });

      if (groupResults.length === 0) {
        logger.debug('No groups in rule, matches nothing', {
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
        });
        return false;
      }

      const finalResult =
        groupLogicOperator === 'or'
          ? groupResults.some((result) => result)
          : groupResults.every((result) => result);

      if (finalResult) {
        logger.debug('Torrent matched rule', {
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          groupResults,
        });
      }

      return finalResult;
    });
  }

  /**
   * Evaluate a single group within a rule
   * @param {Object} group - Group configuration
   * @param {number} groupIndex - Index of the group
   * @param {Object} torrent - Torrent object
   * @param {Object} rule - Rule configuration (for logging)
   * @param {Map} telemetryMap - Pre-loaded telemetry data
   * @param {Map} tagsByDownloadId - Pre-loaded tags data
   * @param {Map} speedHistoryMap - Pre-loaded speed history data
   * @returns {boolean} - True if group matches
   */
  evaluateGroup(group, groupIndex, torrent, rule, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const conditions = group.conditions || [];
    const groupLogicOp = group.logicOperator || 'and';

    if (conditions.length === 0) {
      logger.debug('Empty group in rule, matches nothing', {
        ruleId: rule.id,
        ruleName: rule.name,
        groupIndex,
        torrentId: torrent.id,
      });
      return false;
    }

    const conditionResults = conditions.map((condition, condIndex) => {
      const result = this.evaluateCondition(
        condition,
        torrent,
        telemetryMap,
        tagsByDownloadId,
        speedHistoryMap
      );
      logger.debug('Condition evaluated', {
        ruleId: rule.id,
        ruleName: rule.name,
        groupIndex,
        condIndex,
        conditionType: condition.type,
        conditionOperator: condition.operator,
        conditionValue: condition.value,
        torrentId: torrent.id,
        torrentName: torrent.name,
        matched: result,
      });
      return result;
    });

    const groupResult =
      groupLogicOp === 'or'
        ? conditionResults.some((result) => result)
        : conditionResults.every((result) => result);

    logger.debug('Group evaluation result', {
      ruleId: rule.id,
      ruleName: rule.name,
      groupIndex,
      groupLogicOp,
      conditionResults,
      groupResult,
    });

    return groupResult;
  }

  /**
   * Evaluate rule with flat structure (backward compatibility)
   * @param {Object} rule - Rule configuration with flat conditions
   * @param {Array} torrents - Array of torrent objects
   * @param {Map} telemetryMap - Pre-loaded telemetry data
   * @param {Map} tagsByDownloadId - Pre-loaded tags data
   * @param {Map} speedHistoryMap - Pre-loaded speed history data
   * @returns {Array} - Matching torrents
   */
  evaluateFlatStructure(rule, torrents, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const conditions = rule.conditions || [];
    const logicOperator = rule.logicOperator || 'and';

    return torrents.filter((torrent) => {
      if (conditions.length === 0) {
        logger.debug('Rule has no conditions, matches all torrents', {
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
        });
        return true;
      }

      const conditionResults = conditions.map((condition) => {
        return this.evaluateCondition(
          condition,
          torrent,
          telemetryMap,
          tagsByDownloadId,
          speedHistoryMap
        );
      });

      const finalResult =
        logicOperator === 'or'
          ? conditionResults.some((result) => result)
          : conditionResults.every((result) => result);

      if (finalResult) {
        logger.debug('Torrent matched rule (flat structure)', {
          ruleId: rule.id,
          ruleName: rule.name,
          torrentId: torrent.id,
          torrentName: torrent.name,
          conditionResults,
        });
      }

      return finalResult;
    });
  }

  /**
   * Check if rule has any TAGS conditions (to determine if we need to pre-load tags)
   * @param {Object} rule - Rule configuration
   * @returns {boolean} - True if rule has at least one TAGS condition
   */
  hasTagsCondition(rule) {
    return this.getAllConditions(rule).some((condition) => condition.type === 'TAGS');
  }

  /**
   * Check if rule has any AVG_SPEED conditions (to determine if we need to pre-load speed history)
   * @param {Object} rule - Rule configuration
   * @returns {boolean} - True if rule has at least one AVG_DOWNLOAD_SPEED or AVG_UPLOAD_SPEED condition
   */
  hasAvgSpeedCondition(rule) {
    return this.getAllConditions(rule).some(
      (condition) =>
        condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED'
    );
  }

  /**
   * Get maximum hours needed from all AVG_SPEED conditions in a rule
   * @param {Object} rule - Rule configuration
   * @returns {number} - Maximum hours value with buffer
   */
  getMaxHoursForAvgSpeed(rule) {
    const allConditions = this.getAllConditions(rule);
    let maxHours = DEFAULT_AVG_SPEED_HOURS;

    for (const condition of allConditions) {
      if (condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED') {
        const hours = condition.hours || DEFAULT_AVG_SPEED_HOURS;
        maxHours = Math.max(maxHours, hours);
      }
    }

    return Math.ceil(maxHours * SPEED_HISTORY_BUFFER_MULTIPLIER);
  }

  /**
   * Get all conditions from a rule (supports both group and flat structures)
   * @param {Object} rule - Rule configuration
   * @returns {Array} - Array of all conditions
   */
  getAllConditions(rule) {
    const conditions = [];

    if (rule.groups && Array.isArray(rule.groups)) {
      for (const group of rule.groups) {
        if (group.conditions && Array.isArray(group.conditions)) {
          conditions.push(...group.conditions);
        }
      }
    }

    if (rule.conditions && Array.isArray(rule.conditions)) {
      conditions.push(...rule.conditions);
    }

    return conditions;
  }

  /**
   * Evaluate a single condition
   * @param {Object} condition - Condition to evaluate
   * @param {Object} torrent - Torrent object
   * @param {Map} telemetryMap - Map of torrent_id -> telemetry data (pre-loaded to avoid N+1 queries)
   * @param {Map} tagsByDownloadId - Map of download_id -> array of tags (pre-loaded to avoid N+1 queries)
   * @param {Map} speedHistoryMap - Map of torrent_id -> array of speed history samples (pre-loaded to avoid N+1 queries)
   */
  evaluateCondition(
    condition,
    torrent,
    telemetryMap = new Map(),
    tagsByDownloadId = new Map(),
    speedHistoryMap = new Map()
  ) {
    const telemetry = telemetryMap.get(String(torrent.id));
    const handler = this.getConditionHandler(condition.type);

    if (!handler) {
      logger.warn('Unknown condition type in rule evaluation', {
        conditionType: condition.type,
        condition: JSON.stringify(condition),
        torrentId: torrent.id,
      });
      return false;
    }

    return handler(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap);
  }

  /**
   * Get condition handler function for a given condition type
   * @param {string} conditionType - Type of condition
   * @returns {Function|null} - Handler function or null if not found
   */
  getConditionHandler(conditionType) {
    const handlers = {
      // Time / State (Derived)
      SEEDING_TIME: this.handleSeedingTime.bind(this),
      AGE: this.handleAge.bind(this),
      LAST_DOWNLOAD_ACTIVITY_AT: this.handleLastDownloadActivity.bind(this),
      LAST_UPLOAD_ACTIVITY_AT: this.handleLastUploadActivity.bind(this),

      // Progress & Performance (Direct from API)
      PROGRESS: this.handleProgress.bind(this),
      DOWNLOAD_SPEED: this.handleDownloadSpeed.bind(this),
      UPLOAD_SPEED: this.handleUploadSpeed.bind(this),
      AVG_DOWNLOAD_SPEED: this.handleAvgDownloadSpeed.bind(this),
      AVG_UPLOAD_SPEED: this.handleAvgUploadSpeed.bind(this),
      ETA: this.handleEta.bind(this),

      // Stall & Inactivity (Derived)
      DOWNLOAD_STALLED_TIME: this.handleDownloadStalledTime.bind(this),
      UPLOAD_STALLED_TIME: this.handleUploadStalledTime.bind(this),

      // Swarm & Ratio (Direct from API)
      SEEDS: this.handleSeeds.bind(this),
      PEERS: this.handlePeers.bind(this),
      RATIO: this.handleRatio.bind(this),
      TOTAL_UPLOADED: this.handleTotalUploaded.bind(this),
      TOTAL_DOWNLOADED: this.handleTotalDownloaded.bind(this),

      // Content & Metadata (Direct from API)
      FILE_SIZE: this.handleFileSize.bind(this),
      FILE_COUNT: this.handleFileCount.bind(this),
      NAME: this.handleName.bind(this),
      TRACKER: this.handleTracker.bind(this),
      PRIVATE: this.handlePrivate.bind(this),
      CACHED: this.handleCached.bind(this),
      AVAILABILITY: this.handleAvailability.bind(this),
      ALLOW_ZIP: this.handleAllowZip.bind(this),

      // Lifecycle (Derived or Direct)
      IS_ACTIVE: this.handleIsActive.bind(this),
      SEEDING_ENABLED: this.handleSeedingEnabled.bind(this),
      LONG_TERM_SEEDING: this.handleLongTermSeeding.bind(this),
      STATUS: this.handleStatus.bind(this),
      EXPIRES_AT: this.handleExpiresAt.bind(this),
      TAGS: this.handleTags.bind(this),
    };

    return handlers[conditionType] || null;
  }

  /**
   * Condition handlers - each handles a specific condition type
   */

  handleSeedingTime(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'SEEDING_TIME')) {
      return false;
    }
    if (!torrent.cached_at) {
      return false;
    }
    const now = Date.now();
    const cachedAt = new Date(torrent.cached_at);
    const conditionValue = (now - cachedAt.getTime()) / MS_PER_HOUR;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleAge(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'AGE')) {
      return false;
    }
    if (!torrent.created_at) {
      return false;
    }
    const now = Date.now();
    const conditionValue = (now - new Date(torrent.created_at).getTime()) / MS_PER_HOUR;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleLastDownloadActivity(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'LAST_DOWNLOAD_ACTIVITY_AT')) {
      return false;
    }
    const now = Date.now();
    if (!telemetry || !telemetry.last_download_activity_at) {
      if (condition.operator === 'gt' || condition.operator === 'gte') {
        return true; // Infinite time ago is always greater
      }
      return false;
    }
    const lastDownloadActivity = new Date(telemetry.last_download_activity_at);
    const conditionValue = (now - lastDownloadActivity.getTime()) / MS_PER_MINUTE;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleLastUploadActivity(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'LAST_UPLOAD_ACTIVITY_AT')) {
      return false;
    }
    const now = Date.now();
    if (!telemetry || !telemetry.last_upload_activity_at) {
      if (condition.operator === 'gt' || condition.operator === 'gte') {
        return true; // Infinite time ago is always greater
      }
      return false;
    }
    const lastUploadActivity = new Date(telemetry.last_upload_activity_at);
    const conditionValue = (now - lastUploadActivity.getTime()) / MS_PER_MINUTE;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleProgress(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'PROGRESS')) {
      return false;
    }
    const conditionValue = torrent.progress || 0;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleDownloadSpeed(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'DOWNLOAD_SPEED')) {
      return false;
    }
    const conditionValue = (torrent.download_speed || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleUploadSpeed(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'UPLOAD_SPEED')) {
      return false;
    }
    const conditionValue = (torrent.upload_speed || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleAvgDownloadSpeed(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'AVG_DOWNLOAD_SPEED')) {
      return false;
    }
    const downloadHours = condition.hours || DEFAULT_AVG_SPEED_HOURS;
    const avgDownloadSpeed = this.getAverageSpeedFromMap(
      torrent.id,
      downloadHours,
      'download',
      speedHistoryMap
    );
    const conditionValue = (avgDownloadSpeed || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleAvgUploadSpeed(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'AVG_UPLOAD_SPEED')) {
      return false;
    }
    const uploadHours = condition.hours || DEFAULT_AVG_SPEED_HOURS;
    const avgUploadSpeed = this.getAverageSpeedFromMap(
      torrent.id,
      uploadHours,
      'upload',
      speedHistoryMap
    );
    const conditionValue = (avgUploadSpeed || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleEta(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'ETA')) {
      return false;
    }
    const conditionValue = (torrent.eta || 0) / SECONDS_PER_MINUTE;
    const etaConditionValueInMinutes = condition.value || 0;
    return this.compareValues(conditionValue, condition.operator, etaConditionValueInMinutes);
  }

  handleDownloadStalledTime(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'DOWNLOAD_STALLED_TIME')) {
      return false;
    }
    if (!telemetry || !telemetry.stalled_since) {
      return false;
    }
    const now = Date.now();
    const stalledSince = new Date(telemetry.stalled_since);
    const conditionValue = (now - stalledSince.getTime()) / MS_PER_MINUTE;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleUploadStalledTime(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'UPLOAD_STALLED_TIME')) {
      return false;
    }
    if (!telemetry || !telemetry.upload_stalled_since) {
      return false;
    }
    const now = Date.now();
    const uploadStalledSince = new Date(telemetry.upload_stalled_since);
    const conditionValue = (now - uploadStalledSince.getTime()) / MS_PER_MINUTE;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleSeeds(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'SEEDS')) {
      return false;
    }
    const conditionValue = torrent.seeds || 0;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handlePeers(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'PEERS')) {
      return false;
    }
    const conditionValue = torrent.peers || 0;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleRatio(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'RATIO')) {
      return false;
    }
    let conditionValue = 0;
    if (torrent.ratio !== undefined && torrent.ratio !== null) {
      conditionValue = torrent.ratio;
    } else if (torrent.total_downloaded > 0) {
      conditionValue = (torrent.total_uploaded || 0) / torrent.total_downloaded;
    }
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleTotalUploaded(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'TOTAL_UPLOADED')) {
      return false;
    }
    const conditionValue = (torrent.total_uploaded || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleTotalDownloaded(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'TOTAL_DOWNLOADED')) {
      return false;
    }
    const conditionValue = (torrent.total_downloaded || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleFileSize(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'FILE_SIZE')) {
      return false;
    }
    const conditionValue = (torrent.size || 0) / BYTES_PER_MB;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleFileCount(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'FILE_COUNT')) {
      return false;
    }
    const conditionValue = torrent.files?.length || 0;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleName(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateStringCondition(condition, 'NAME')) {
      return false;
    }
    return this.compareStringValues(torrent.name, condition.operator, condition.value);
  }

  handleTracker(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateStringCondition(condition, 'TRACKER')) {
      return false;
    }
    return this.compareStringValues(torrent.tracker, condition.operator, condition.value);
  }

  handlePrivate(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const isPrivate = this.normalizeBooleanValue(torrent.private);
    return this.evaluateBooleanCondition(isPrivate, condition);
  }

  handleCached(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const isCached = this.normalizeBooleanValue(torrent.cached);
    return this.evaluateBooleanCondition(isCached, condition);
  }

  handleAvailability(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    if (!this.validateNumericCondition(condition, 'AVAILABILITY')) {
      return false;
    }
    const conditionValue = torrent.availability || 0;
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleAllowZip(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const allowZip = this.normalizeBooleanValue(torrent.allow_zipped);
    return this.evaluateBooleanCondition(allowZip, condition);
  }

  handleIsActive(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const isActive = this.normalizeBooleanValue(torrent.active);
    return this.evaluateBooleanCondition(isActive, condition);
  }

  handleSeedingEnabled(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    const seedingEnabled = this.normalizeBooleanValue(torrent.seed_torrent);
    return this.evaluateBooleanCondition(seedingEnabled, condition);
  }

  handleLongTermSeeding(
    condition,
    torrent,
    telemetry,
    telemetryMap,
    tagsByDownloadId,
    speedHistoryMap
  ) {
    const longTermSeeding = this.normalizeBooleanValue(torrent.long_term_seeding);
    return this.evaluateBooleanCondition(longTermSeeding, condition);
  }

  handleStatus(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    const torrentStatus = this.getTorrentStatus(torrent);
    if (!Array.isArray(condition.value)) {
      logger.debug('STATUS condition has invalid value (not an array)', {
        torrentId: torrent.id,
        conditionValue: condition.value,
      });
      return false;
    }

    const operator = condition.operator || 'is_any_of';
    const statusMatches = condition.value.length > 0 && condition.value.includes(torrentStatus);

    switch (operator) {
      case 'is_any_of':
        return statusMatches;
      case 'is_none_of':
        return !statusMatches;
      default:
        return statusMatches;
    }
  }

  handleExpiresAt(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!this.validateNumericCondition(condition, 'EXPIRES_AT')) {
      return false;
    }
    if (!torrent.expires_at) {
      return false;
    }
    const now = Date.now();
    const expiresAt = new Date(torrent.expires_at);
    const conditionValue = (expiresAt.getTime() - now) / MS_PER_HOUR;
    if (conditionValue < 0 && (condition.operator === 'gt' || condition.operator === 'gte')) {
      return false;
    }
    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  handleTags(condition, torrent, telemetry, telemetryMap, tagsByDownloadId, speedHistoryMap) {
    if (!Array.isArray(condition.value)) {
      logger.debug('TAGS condition has invalid value (not an array)', {
        torrentId: torrent.id,
        conditionValue: condition.value,
      });
      return false;
    }

    if (!condition.operator) {
      logger.debug('TAGS condition missing operator', {
        torrentId: torrent.id,
        condition: JSON.stringify(condition),
      });
      return false;
    }

    const downloadId = this.extractDownloadId(torrent);
    if (!downloadId) {
      return false;
    }

    const downloadTags = tagsByDownloadId.get(downloadId) || [];
    const downloadTagIds = downloadTags.map((tag) => tag.id);
    const conditionTagIds = condition.value
      .map((v) => (typeof v === 'number' ? v : parseInt(v, 10)))
      .filter((id) => !isNaN(id));

    if (conditionTagIds.length === 0) {
      return true;
    }

    switch (condition.operator) {
      case 'has_any':
      case 'is_any_of':
        return conditionTagIds.some((tagId) => downloadTagIds.includes(tagId));
      case 'has_all':
      case 'is_all_of':
        return conditionTagIds.every((tagId) => downloadTagIds.includes(tagId));
      case 'has_none':
      case 'is_none_of':
        return !conditionTagIds.some((tagId) => downloadTagIds.includes(tagId));
      default:
        logger.debug('TAGS condition has invalid operator', {
          torrentId: torrent.id,
          operator: condition.operator,
          condition: JSON.stringify(condition),
        });
        return false;
    }
  }

  /**
   * Get average speed for a torrent over a specified number of hours
   * Uses pre-loaded speed history map if available, otherwise queries database
   * @param {string} torrentId - Torrent ID
   * @param {number} hours - Number of hours to calculate average over
   * @param {string} type - 'download' or 'upload'
   * @param {Map} speedHistoryMap - Optional pre-loaded speed history map (torrent_id -> array of samples)
   * @returns {number} - Average speed in bytes per second
   */
  getAverageSpeed(torrentId, hours, type = 'download', speedHistoryMap = null) {
    let samples;

    // Use pre-loaded data if available
    if (speedHistoryMap && speedHistoryMap.has(String(torrentId))) {
      const allSamples = speedHistoryMap.get(String(torrentId));
      const now = new Date();
      const hoursAgo = new Date(now - hours * MS_PER_HOUR);

      // Filter samples within the time window
      samples = allSamples.filter((sample) => new Date(sample.timestamp) >= hoursAgo);
    } else {
      // Fallback to database query (for backward compatibility)
      const now = new Date();
      const hoursAgo = new Date(now - hours * MS_PER_HOUR);

      samples = this.db
        .prepare(
          `
        SELECT * FROM speed_history
        WHERE torrent_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `
        )
        .all(torrentId, hoursAgo.toISOString());
    }

    const field = type === 'download' ? 'total_downloaded' : 'total_uploaded';
    return this.calculateAverageSpeed(samples, field);
  }

  /**
   * Get average speed from pre-loaded speed history map
   * @param {string} torrentId - Torrent ID
   * @param {number} hours - Number of hours to calculate average over
   * @param {string} type - 'download' or 'upload'
   * @param {Map} speedHistoryMap - Pre-loaded speed history map (torrent_id -> array of samples)
   * @returns {number} - Average speed in bytes per second
   */
  getAverageSpeedFromMap(torrentId, hours, type = 'download', speedHistoryMap = new Map()) {
    return this.getAverageSpeed(torrentId, hours, type, speedHistoryMap);
  }

  /**
   * Get torrent status based on multiple fields
   */
  getTorrentStatus(torrent) {
    return getTorrentStatusUtil(torrent);
  }

  /**
   * Calculate average speed from samples
   */
  calculateAverageSpeed(samples, field) {
    if (samples.length < 2) {
      return 0;
    }

    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDelta = (new Date(last.timestamp) - new Date(first.timestamp)) / 1000;

    if (timeDelta === 0) {
      return 0;
    }

    const valueDelta = last[field] - first[field];
    return valueDelta / timeDelta;
  }

  /**
   * Calculate max speed from samples
   */
  calculateMaxSpeed(samples, field) {
    if (samples.length < 2) {
      return 0;
    }

    let maxSpeed = 0;
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const timeDelta = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;

      if (timeDelta > 0) {
        const speed = (curr[field] - prev[field]) / timeDelta;
        maxSpeed = Math.max(maxSpeed, speed);
      }
    }

    return maxSpeed;
  }

  /**
   * Validate that a condition has required operator and value for numeric comparisons
   * @param {Object} condition - Condition object to validate
   * @param {string} conditionType - Type of condition for logging
   * @returns {boolean} - True if condition has valid operator and value
   */
  validateNumericCondition(condition, conditionType = '') {
    if (!condition.operator) {
      logger.debug('Numeric condition missing operator', {
        conditionType,
        condition: JSON.stringify(condition),
      });
      return false;
    }

    if (condition.value === undefined || condition.value === null) {
      logger.debug('Numeric condition missing value', {
        conditionType,
        operator: condition.operator,
        condition: JSON.stringify(condition),
      });
      return false;
    }

    if (!this.isValidNumericOperator(condition.operator)) {
      logger.debug('Numeric condition has invalid operator', {
        conditionType,
        operator: condition.operator,
        condition: JSON.stringify(condition),
      });
      return false;
    }

    return true;
  }

  /**
   * Validate that a condition has required value for string comparisons
   * @param {Object} condition - Condition object to validate
   * @param {string} conditionType - Type of condition for logging
   * @returns {boolean} - True if condition has valid value
   */
  validateStringCondition(condition, conditionType = '') {
    if (condition.value === undefined || condition.value === null || condition.value === '') {
      logger.debug('String condition missing value', {
        conditionType,
        operator: condition.operator,
        condition: JSON.stringify(condition),
      });
      return false;
    }

    return true;
  }

  /**
   * Normalize a boolean value from various formats (true, 1, 'true', etc.)
   * @param {any} value - Value to normalize
   * @returns {boolean} - Normalized boolean value
   */
  normalizeBooleanValue(value) {
    return value === true || value === 1 || value === 'true';
  }

  /**
   * Evaluate a boolean condition
   * Handles is_true, is_false operators and numeric/boolean value comparisons
   * @param {boolean} fieldValue - The boolean field value
   * @param {Object} condition - Condition object with operator and value
   * @returns {boolean} - True if the condition matches
   */
  evaluateBooleanCondition(fieldValue, condition) {
    // Handle boolean operators (is_true, is_false) - these don't need a value
    if (condition.operator === 'is_true') {
      return fieldValue;
    }
    if (condition.operator === 'is_false') {
      return !fieldValue;
    }

    // If operator is provided, treat as numeric comparison (0/1)
    if (condition.operator) {
      const numericValue = fieldValue ? 1 : 0;
      return this.compareValues(numericValue, condition.operator, condition.value);
    }

    // Direct boolean match (backward compatibility)
    const expectedValue = this.normalizeBooleanValue(condition.value);
    return fieldValue === expectedValue;
  }

  /**
   * Compare string values with string operators
   * Supports: contains, not_contains, equals, not_equals, starts_with, ends_with
   * @param {string} fieldValue - The field value to compare
   * @param {string} operator - The string operator
   * @param {string} conditionValue - The condition value to compare against
   * @returns {boolean} - True if the condition matches
   */
  compareStringValues(fieldValue, operator, conditionValue) {
    const normalizedField = (fieldValue || '').toLowerCase();
    const normalizedCondition = (conditionValue || '').toLowerCase();

    switch (operator) {
      case 'contains':
        return normalizedField.includes(normalizedCondition);
      case 'not_contains':
        return !normalizedField.includes(normalizedCondition);
      case 'equals':
        return normalizedField === normalizedCondition;
      case 'not_equals':
        return normalizedField !== normalizedCondition;
      case 'starts_with':
        return normalizedField.startsWith(normalizedCondition);
      case 'ends_with':
        return normalizedField.endsWith(normalizedCondition);
      default:
        // Default to contains if operator not specified or unknown
        logger.debug('String condition using default contains operator', {
          operator,
          fieldValue,
          conditionValue,
        });
        return normalizedField.includes(normalizedCondition);
    }
  }

  /**
   * Check if operator is valid for numeric comparisons
   * @param {string} operator - Operator to validate
   * @returns {boolean} - True if operator is valid for numeric comparisons
   */
  isValidNumericOperator(operator) {
    const validOperators = ['gt', 'lt', 'gte', 'lte', 'eq'];
    return validOperators.includes(operator);
  }

  /**
   * Compare values with operator
   * @param {number} value1 - First value to compare
   * @param {string} operator - Comparison operator (gt, lt, gte, lte, eq)
   * @param {number} value2 - Second value to compare
   * @returns {boolean} - True if the condition matches
   */
  compareValues(value1, operator, value2) {
    // Validate operator before comparison
    if (!this.isValidNumericOperator(operator)) {
      logger.debug('Invalid numeric operator, defaulting to false', {
        operator,
        value1,
        value2,
      });
      return false;
    }

    switch (operator) {
      case 'gt':
        return value1 > value2;
      case 'lt':
        return value1 < value2;
      case 'gte':
        return value1 >= value2;
      case 'lte':
        return value1 <= value2;
      case 'eq':
        return value1 === value2;
      default:
        return false;
    }
  }

  /**
   * Archive a download to the database
   * @param {Object} torrent - Torrent object with id, hash, tracker, name
   */
  async archiveDownload(torrent) {
    try {
      const { id, hash, tracker, name } = torrent;

      if (!id || !hash) {
        throw new Error('torrent id and hash are required for archiving');
      }

      // Check if already archived
      const existing = this.db
        .prepare(
          `
        SELECT id FROM archived_downloads WHERE torrent_id = ?
      `
        )
        .get(id);

      if (existing) {
        logger.debug('Download already archived, skipping', { torrentId: id });
        return { success: true, message: 'Already archived' };
      }

      // Insert new archive entry
      this.db
        .prepare(
          `
        INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
        )
        .run(id, hash, tracker || null, name || null);

      return { success: true, message: 'Download archived successfully' };
    } catch (error) {
      logger.error('Error archiving download', error, {
        torrentId: torrent.id,
        torrentName: torrent.name,
      });
      throw error;
    }
  }

  /**
   * Execute action on a torrent
   */
  async executeAction(action, torrent) {
    if (!action) {
      throw new Error('Action is required but was not provided');
    }

    if (!action.type) {
      throw new Error(
        `Action type is required but was not provided. Action: ${JSON.stringify(action)}`
      );
    }

    switch (action.type) {
      // TorBox API Actions
      case 'stop_seeding':
        return await this.apiClient.controlTorrent(torrent.id, 'stop_seeding');

      case 'force_start':
        return await this.apiClient.controlTorrent(torrent.id, 'force_start');

      case 'delete':
        return await this.apiClient.deleteTorrent(torrent.id);

      // Pause and Resume actions have been deprecated in TorBox API
      // case 'pause':
      //   return await this.apiClient.controlTorrent(torrent.id, 'pause');

      // case 'resume':
      //   return await this.apiClient.controlTorrent(torrent.id, 'resume');

      // TBM Actions
      case 'archive':
        const archiveResult = await this.archiveDownload(torrent);
        // If already archived, don't delete the torrent
        if (archiveResult.message === 'Already archived') {
          return archiveResult;
        }
        return await this.apiClient.deleteTorrent(torrent.id);

      case 'add_tag':
        return await this.addTagsToDownload(action, torrent);

      case 'remove_tag':
        return await this.removeTagsFromDownload(action, torrent);

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Add tags to a download
   * @param {Object} action - Action object with type and tagIds
   * @param {Object} torrent - Torrent object
   */
  async addTagsToDownload(action, torrent) {
    // Validate tagIds
    if (!Array.isArray(action.tagIds) || action.tagIds.length === 0) {
      throw new Error('tagIds must be a non-empty array for add_tag action');
    }

    // Extract download ID (supporting multiple formats)
    const downloadId = this.extractDownloadId(torrent);

    if (!downloadId) {
      throw new Error('Download ID is required but could not be extracted from torrent');
    }

    // Validate all tag IDs exist
    const placeholders = action.tagIds.map(() => '?').join(',');
    const existingTags = this.db
      .prepare(
        `
      SELECT id FROM tags WHERE id IN (${placeholders})
    `
      )
      .all(...action.tagIds);

    if (existingTags.length !== action.tagIds.length) {
      throw new Error('One or more tag IDs are invalid');
    }

    // Add tags using transaction
    const transaction = this.db.transaction(() => {
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO download_tags (tag_id, download_id)
        VALUES (?, ?)
      `);

      for (const tagId of action.tagIds) {
        insertStmt.run(tagId, downloadId);
      }
    });

    transaction();

    logger.debug('Tags added to download', {
      downloadId,
      tagIds: action.tagIds,
      tagCount: action.tagIds.length,
    });

    return {
      success: true,
      message: `Added ${action.tagIds.length} tag(s) to download`,
    };
  }

  /**
   * Remove tags from a download
   * @param {Object} action - Action object with type and tagIds
   * @param {Object} torrent - Torrent object
   */
  async removeTagsFromDownload(action, torrent) {
    // Validate tagIds
    if (!Array.isArray(action.tagIds) || action.tagIds.length === 0) {
      throw new Error('tagIds must be a non-empty array for remove_tag action');
    }

    // Extract download ID (supporting multiple formats)
    const downloadId = this.extractDownloadId(torrent);

    if (!downloadId) {
      throw new Error('Download ID is required but could not be extracted from torrent');
    }

    // Validate all tag IDs exist
    const placeholders = action.tagIds.map(() => '?').join(',');
    const existingTags = this.db
      .prepare(
        `
      SELECT id FROM tags WHERE id IN (${placeholders})
    `
      )
      .all(...action.tagIds);

    if (existingTags.length !== action.tagIds.length) {
      throw new Error('One or more tag IDs are invalid');
    }

    // Remove tags using transaction
    const transaction = this.db.transaction(() => {
      const tagPlaceholders = action.tagIds.map(() => '?').join(',');
      this.db
        .prepare(
          `
        DELETE FROM download_tags 
        WHERE download_id = ? 
          AND tag_id IN (${tagPlaceholders})
      `
        )
        .run(downloadId, ...action.tagIds);
    });

    transaction();

    logger.debug('Tags removed from download', {
      downloadId,
      tagIds: action.tagIds,
      tagCount: action.tagIds.length,
    });

    return {
      success: true,
      message: `Removed ${action.tagIds.length} tag(s) from download`,
    };
  }
}

export default RuleEvaluator;
