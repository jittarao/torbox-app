import { getTorrentStatus as getTorrentStatusUtil } from '../utils/torrentStatus.js';
import logger from '../utils/logger.js';
import { applyIntervalMultiplier } from '../utils/intervalUtils.js';

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

    // Check trigger interval (if configured)
    if (rule.trigger && rule.trigger.type === 'interval' && rule.trigger.value) {
      const intervalMinutes = rule.trigger.value;
      
      // Enforce minimum interval of 1 minute
      if (intervalMinutes < 1) {
        logger.warn('Rule has invalid interval (less than 1 minute), using 1 minute minimum', {
          ruleId: rule.id,
          ruleName: rule.name,
          intervalMinutes
        });
        // Continue with evaluation - we'll use 1 minute as minimum
      }
      
      // Check if interval has elapsed since last evaluation
      if (rule.last_evaluated_at) {
        const lastEvaluated = new Date(rule.last_evaluated_at);
        // Apply development multiplier to reduce intervals for testing
        const adjustedIntervalMinutes = applyIntervalMultiplier(Math.max(intervalMinutes, 1));
        const intervalMs = adjustedIntervalMinutes * 60 * 1000; // At least 1 minute (or adjusted minimum)
        const timeSinceLastEvaluation = Date.now() - lastEvaluated.getTime();
        
        if (timeSinceLastEvaluation < intervalMs) {
          // Interval hasn't elapsed yet, skip evaluation
          const remainingMs = intervalMs - timeSinceLastEvaluation;
          const remainingMinutes = (remainingMs / (60 * 1000)).toFixed(2);
          logger.debug('Rule evaluation skipped - interval not elapsed', {
            ruleId: rule.id,
            ruleName: rule.name,
            intervalMinutes,
            lastEvaluatedAt: rule.last_evaluated_at,
            timeSinceLastEvaluation: `${(timeSinceLastEvaluation / (60 * 1000)).toFixed(2)} minutes`,
            remainingMinutes: `${remainingMinutes} minutes`,
            nextEvaluationIn: `${remainingMinutes} minutes`
          });
          return [];
        }
        
        logger.debug('Rule interval elapsed, proceeding with evaluation', {
          ruleId: rule.id,
          ruleName: rule.name,
          intervalMinutes,
          lastEvaluatedAt: rule.last_evaluated_at,
          timeSinceLastEvaluation: `${(timeSinceLastEvaluation / (60 * 1000)).toFixed(2)} minutes`
        });
      } else {
        logger.debug('Rule has no last_evaluated_at, evaluating immediately', {
          ruleId: rule.id,
          ruleName: rule.name,
          intervalMinutes
        });
      }
      // If last_evaluated_at is NULL, treat as "never evaluated" and evaluate immediately
    }
    // If no interval trigger configured, evaluate on every poll (backward compatible)

    // Batch load all telemetry data to avoid N+1 queries
    const torrentIds = torrents.map(t => t.id).filter(id => id != null);
    let telemetryMap = new Map();
    
    if (torrentIds.length > 0) {
      const placeholders = torrentIds.map(() => '?').join(',');
      const allTelemetry = this.db.prepare(`
        SELECT * FROM torrent_telemetry 
        WHERE torrent_id IN (${placeholders})
      `).all(...torrentIds);
      
      // Normalize keys to strings to ensure consistent lookups
      telemetryMap = new Map(allTelemetry.map(t => [String(t.torrent_id), t]));
    }

    // Check if any condition uses TAGS type to determine if we need to pre-load tags
    const hasTagsCondition = this.hasTagsCondition(rule);
    
    // Batch load all download tags to avoid N+1 queries
    let tagsByDownloadId = new Map();
    if (hasTagsCondition && torrents.length > 0) {
      // Collect all possible download IDs (supporting multiple formats)
      const allDownloadIds = new Set();
      for (const torrent of torrents) {
        const downloadId = torrent.id?.toString() || torrent.torrent_id?.toString() || 
                          torrent.usenet_id?.toString() || torrent.web_id?.toString();
        if (downloadId) {
          allDownloadIds.add(downloadId);
        }
      }
      
      if (allDownloadIds.size > 0) {
        const downloadIdArray = Array.from(allDownloadIds);
        const placeholders = downloadIdArray.map(() => '?').join(',');
        const allDownloadTags = this.db.prepare(`
          SELECT dt.download_id, t.id, t.name
          FROM download_tags dt
          INNER JOIN tags t ON dt.tag_id = t.id
          WHERE dt.download_id IN (${placeholders})
        `).all(...downloadIdArray);
        
        // Group tags by download_id
        for (const row of allDownloadTags) {
          const downloadId = String(row.download_id);
          if (!tagsByDownloadId.has(downloadId)) {
            tagsByDownloadId.set(downloadId, []);
          }
          tagsByDownloadId.get(downloadId).push({ id: row.id, name: row.name });
        }
      }
    }

    // Check if any condition uses AVG_SPEED type to determine if we need to pre-load speed history
    const hasAvgSpeedCondition = this.hasAvgSpeedCondition(rule);
    
    // Batch load all speed history data to avoid N+1 queries
    let speedHistoryMap = new Map();
    if (hasAvgSpeedCondition && torrentIds.length > 0) {
      const maxHours = this.getMaxHoursForAvgSpeed(rule);
      const now = new Date();
      const hoursAgo = new Date(now - maxHours * 60 * 60 * 1000);
      
      const placeholders = torrentIds.map(() => '?').join(',');
      const allSpeedHistory = this.db.prepare(`
        SELECT * FROM speed_history
        WHERE torrent_id IN (${placeholders}) AND timestamp >= ?
        ORDER BY torrent_id, timestamp ASC
      `).all(...torrentIds, hoursAgo.toISOString());
      
      // Group samples by torrent_id
      for (const sample of allSpeedHistory) {
        const torrentId = String(sample.torrent_id);
        if (!speedHistoryMap.has(torrentId)) {
          speedHistoryMap.set(torrentId, []);
        }
        speedHistoryMap.get(torrentId).push(sample);
      }
    }

    // Support both old flat structure and new group structure
    const hasGroups = rule.groups && Array.isArray(rule.groups) && rule.groups.length > 0;
    
    logger.debug('Evaluating rule against torrents', {
      ruleId: rule.id,
      ruleName: rule.name,
      hasGroups,
      torrentCount: torrents.length,
      groupCount: hasGroups ? rule.groups.length : 0
    });
    
    if (hasGroups) {
      // New group structure
      const groupLogicOperator = rule.logicOperator || 'and';
      
      const matchingTorrents = torrents.filter(torrent => {
        // Evaluate each group
        const groupResults = rule.groups.map((group, groupIndex) => {
          const conditions = group.conditions || [];
          const groupLogicOp = group.logicOperator || 'and';
          
          if (conditions.length === 0) {
            logger.debug('Empty group in rule, matches nothing', {
              ruleId: rule.id,
              ruleName: rule.name,
              groupIndex,
              torrentId: torrent.id
            });
            return false; // Empty group matches nothing
          }
          
          // Evaluate conditions within the group
          const conditionResults = conditions.map((condition, condIndex) => {
            const result = this.evaluateCondition(condition, torrent, telemetryMap, tagsByDownloadId, speedHistoryMap);
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
              matched: result
            });
            return result;
          });
          
          // Apply group logic operator
          const groupResult = groupLogicOp === 'or' 
            ? conditionResults.some(result => result)
            : conditionResults.every(result => result);
          
          logger.debug('Group evaluation result', {
            ruleId: rule.id,
            ruleName: rule.name,
            groupIndex,
            groupLogicOp,
            conditionResults,
            groupResult
          });
          
          return groupResult;
        });
        
        // Apply logic operator between groups
        if (groupResults.length === 0) {
          logger.debug('No groups in rule, matches nothing', {
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id
          });
          return false; // No groups means match nothing
        }
        
        const finalResult = groupLogicOperator === 'or'
          ? groupResults.some(result => result)
          : groupResults.every(result => result);
        
        if (finalResult) {
          logger.debug('Torrent matched rule', {
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            groupResults
          });
        }
        
        return finalResult;
      });
      
      logger.info('Rule evaluation completed', {
        ruleId: rule.id,
        ruleName: rule.name,
        torrentCount: torrents.length,
        matchedCount: matchingTorrents.length,
        matchedIds: matchingTorrents.map(t => t.id)
      });
      
      return matchingTorrents;
    } else {
      // Old flat structure (backward compatibility)
      const conditions = rule.conditions || [];
      const logicOperator = rule.logicOperator || 'and';

      const matchingTorrents = torrents.filter(torrent => {
        if (conditions.length === 0) {
          logger.debug('Rule has no conditions, matches all torrents', {
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id
          });
          return true; // No conditions means match everything
        }
        
        const conditionResults = conditions.map((condition, condIndex) => {
          const result = this.evaluateCondition(condition, torrent, telemetryMap, tagsByDownloadId, speedHistoryMap);
          // logger.debug('Condition evaluated (flat structure)', {
          //   ruleId: rule.id,
          //   ruleName: rule.name,
          //   condIndex,
          //   conditionType: condition.type,
          //   conditionOperator: condition.operator,
          //   conditionValue: condition.value,
          //   torrentId: torrent.id,
          //   torrentName: torrent.name,
          //   matched: result
          // });
          return result;
        });

        // Apply logic operator
        const finalResult = logicOperator === 'or'
          ? conditionResults.some(result => result)
          : conditionResults.every(result => result);
        
        if (finalResult) {
          logger.debug('Torrent matched rule (flat structure)', {
            ruleId: rule.id,
            ruleName: rule.name,
            torrentId: torrent.id,
            torrentName: torrent.name,
            conditionResults
          });
        }
        
        return finalResult;
      });

      logger.info('Rule evaluation completed (flat structure)', {
        ruleId: rule.id,
        ruleName: rule.name,
        torrentCount: torrents.length,
        matchedCount: matchingTorrents.length,
        matchedIds: matchingTorrents.map(t => t.id)
      });

      return matchingTorrents;
    }
  }

  /**
   * Check if rule has any TAGS conditions (to determine if we need to pre-load tags)
   * @param {Object} rule - Rule configuration
   * @returns {boolean} - True if rule has at least one TAGS condition
   */
  hasTagsCondition(rule) {
    // Check new group structure
    if (rule.groups && Array.isArray(rule.groups)) {
      for (const group of rule.groups) {
        const conditions = group.conditions || [];
        if (conditions.some(condition => condition.type === 'TAGS')) {
          return true;
        }
      }
    }
    
    // Check old flat structure
    const conditions = rule.conditions || [];
    return conditions.some(condition => condition.type === 'TAGS');
  }

  /**
   * Check if rule has any AVG_SPEED conditions (to determine if we need to pre-load speed history)
   * @param {Object} rule - Rule configuration
   * @returns {boolean} - True if rule has at least one AVG_DOWNLOAD_SPEED or AVG_UPLOAD_SPEED condition
   */
  hasAvgSpeedCondition(rule) {
    // Check new group structure
    if (rule.groups && Array.isArray(rule.groups)) {
      for (const group of rule.groups) {
        const conditions = group.conditions || [];
        if (conditions.some(condition => 
          condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED'
        )) {
          return true;
        }
      }
    }
    
    // Check old flat structure
    const conditions = rule.conditions || [];
    return conditions.some(condition => 
      condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED'
    );
  }

  /**
   * Get maximum hours needed from all AVG_SPEED conditions in a rule
   * @param {Object} rule - Rule configuration
   * @returns {number} - Maximum hours value (defaults to 24 if no conditions found)
   */
  getMaxHoursForAvgSpeed(rule) {
    let maxHours = 1; // Default minimum
    
    // Check new group structure
    if (rule.groups && Array.isArray(rule.groups)) {
      for (const group of rule.groups) {
        const conditions = group.conditions || [];
        for (const condition of conditions) {
          if (condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED') {
            const hours = condition.hours || 1;
            maxHours = Math.max(maxHours, hours);
          }
        }
      }
    }
    
    // Check old flat structure
    const conditions = rule.conditions || [];
    for (const condition of conditions) {
      if (condition.type === 'AVG_DOWNLOAD_SPEED' || condition.type === 'AVG_UPLOAD_SPEED') {
        const hours = condition.hours || 1;
        maxHours = Math.max(maxHours, hours);
      }
    }
    
    // Add some buffer (50% more) to ensure we have enough data
    return Math.ceil(maxHours * 1.5);
  }

  /**
   * Evaluate a single condition
   * @param {Object} condition - Condition to evaluate
   * @param {Object} torrent - Torrent object
   * @param {Map} telemetryMap - Map of torrent_id -> telemetry data (pre-loaded to avoid N+1 queries)
   * @param {Map} tagsByDownloadId - Map of download_id -> array of tags (pre-loaded to avoid N+1 queries)
   * @param {Map} speedHistoryMap - Map of torrent_id -> array of speed history samples (pre-loaded to avoid N+1 queries)
   */
  evaluateCondition(condition, torrent, telemetryMap = new Map(), tagsByDownloadId = new Map(), speedHistoryMap = new Map()) {
    const now = Date.now();
    let conditionValue = 0;

    // Get telemetry for derived fields from pre-loaded map
    // Normalize torrent.id to string for consistent lookup
    const telemetry = telemetryMap.get(String(torrent.id));

    switch (condition.type) {
      // ===== Time / State (Derived) =====
      case 'SEEDING_TIME':
        if (!this.validateNumericCondition(condition, 'SEEDING_TIME')) {
          return false;
        }
        if (!torrent.cached_at) {
          return false;
        }
        const cachedAt = new Date(torrent.cached_at);
        conditionValue = (now - cachedAt.getTime()) / (1000 * 60 * 60); // hours
        break;

      case 'AGE':
        if (!this.validateNumericCondition(condition, 'AGE')) {
          return false;
        }
        if (!torrent.created_at) {
          // If no created_at, cannot determine age - return false
          return false;
        }
        conditionValue = (now - new Date(torrent.created_at).getTime()) / (1000 * 60 * 60); // hours
        break;

      case 'LAST_DOWNLOAD_ACTIVITY_AT':
        if (!this.validateNumericCondition(condition, 'LAST_DOWNLOAD_ACTIVITY_AT')) {
          return false;
        }
        if (!telemetry || !telemetry.last_download_activity_at) {
          // If no activity recorded, treat as "infinite" time ago
          // Only match if operator is 'gt' (more than X minutes ago)
          if (condition.operator === 'gt' || condition.operator === 'gte') {
            conditionValue = Infinity; // Will always be greater than any value
          } else {
            return false; // No activity means it can't be "less than" or "equal to"
          }
        } else {
          const lastDownloadActivity = new Date(telemetry.last_download_activity_at);
          conditionValue = (now - lastDownloadActivity.getTime()) / (1000 * 60); // minutes ago
        }
        break;

      case 'LAST_UPLOAD_ACTIVITY_AT':
        if (!this.validateNumericCondition(condition, 'LAST_UPLOAD_ACTIVITY_AT')) {
          return false;
        }
        if (!telemetry || !telemetry.last_upload_activity_at) {
          // If no activity recorded, treat as "infinite" time ago
          // Only match if operator is 'gt' (more than X minutes ago)
          if (condition.operator === 'gt' || condition.operator === 'gte') {
            conditionValue = Infinity; // Will always be greater than any value
          } else {
            return false; // No activity means it can't be "less than" or "equal to"
          }
        } else {
          const lastUploadActivity = new Date(telemetry.last_upload_activity_at);
          conditionValue = (now - lastUploadActivity.getTime()) / (1000 * 60); // minutes ago
        }
        break;

      // ===== Progress & Performance (Direct from API) =====
      case 'PROGRESS':
        if (!this.validateNumericCondition(condition, 'PROGRESS')) {
          return false;
        }
        conditionValue = torrent.progress || 0;
        break;

      case 'DOWNLOAD_SPEED':
        if (!this.validateNumericCondition(condition, 'DOWNLOAD_SPEED')) {
          return false;
        }
        // Convert from bytes/s to MB/s
        conditionValue = (torrent.download_speed || 0) / (1024 * 1024);
        break;

      case 'UPLOAD_SPEED':
        if (!this.validateNumericCondition(condition, 'UPLOAD_SPEED')) {
          return false;
        }
        // Convert from bytes/s to MB/s
        conditionValue = (torrent.upload_speed || 0) / (1024 * 1024);
        break;

      case 'AVG_DOWNLOAD_SPEED':
        if (!this.validateNumericCondition(condition, 'AVG_DOWNLOAD_SPEED')) {
          return false;
        }
        // Get hours parameter (default to 1 hour if not specified)
        const downloadHours = condition.hours || 1;
        // Get average speed using pre-loaded speed history if available
        const avgDownloadSpeed = this.getAverageSpeedFromMap(
          torrent.id, 
          downloadHours, 
          'download', 
          speedHistoryMap
        );
        // Convert from bytes/s to MB/s
        conditionValue = (avgDownloadSpeed || 0) / (1024 * 1024);
        break;

      case 'AVG_UPLOAD_SPEED':
        if (!this.validateNumericCondition(condition, 'AVG_UPLOAD_SPEED')) {
          return false;
        }
        // Get hours parameter (default to 1 hour if not specified)
        const uploadHours = condition.hours || 1;
        // Get average speed using pre-loaded speed history if available
        const avgUploadSpeed = this.getAverageSpeedFromMap(
          torrent.id, 
          uploadHours, 
          'upload', 
          speedHistoryMap
        );
        // Convert from bytes/s to MB/s
        conditionValue = (avgUploadSpeed || 0) / (1024 * 1024);
        break;

      case 'ETA':
        if (!this.validateNumericCondition(condition, 'ETA')) {
          return false;
        }
        // ETA from API is in seconds, convert to minutes for comparison
        conditionValue = (torrent.eta || 0) / 60; // Convert seconds to minutes
        const etaConditionValueInMinutes = (condition.value || 0);
        return this.compareValues(conditionValue, condition.operator, etaConditionValueInMinutes);

      // ===== Stall & Inactivity (Derived) =====
      case 'DOWNLOAD_STALLED_TIME':
        if (!this.validateNumericCondition(condition, 'DOWNLOAD_STALLED_TIME')) {
          return false;
        }
        if (!telemetry || !telemetry.stalled_since) {
          return false;
        }
        const stalledSince = new Date(telemetry.stalled_since);
        conditionValue = (now - stalledSince.getTime()) / (1000 * 60); // minutes
        break;

      case 'UPLOAD_STALLED_TIME':
        if (!this.validateNumericCondition(condition, 'UPLOAD_STALLED_TIME')) {
          return false;
        }
        if (!telemetry || !telemetry.upload_stalled_since) {
          return false;
        }
        const uploadStalledSince = new Date(telemetry.upload_stalled_since);
        conditionValue = (now - uploadStalledSince.getTime()) / (1000 * 60); // minutes
        break;

      // ===== Swarm & Ratio (Direct from API) =====
      case 'SEEDS':
        if (!this.validateNumericCondition(condition, 'SEEDS')) {
          return false;
        }
        conditionValue = torrent.seeds || 0;
        break;

      case 'PEERS':
        if (!this.validateNumericCondition(condition, 'PEERS')) {
          return false;
        }
        conditionValue = torrent.peers || 0;
        break;

      case 'RATIO':
        if (!this.validateNumericCondition(condition, 'RATIO')) {
          return false;
        }
        // Try ratio field first, fallback to calculation
        if (torrent.ratio !== undefined && torrent.ratio !== null) {
          conditionValue = torrent.ratio;
        } else if (torrent.total_downloaded > 0) {
          conditionValue = (torrent.total_uploaded || 0) / torrent.total_downloaded;
        } else {
          conditionValue = 0;
        }
        break;

      case 'TOTAL_UPLOADED':
        if (!this.validateNumericCondition(condition, 'TOTAL_UPLOADED')) {
          return false;
        }
        conditionValue = (torrent.total_uploaded || 0) / (1024 * 1024); // MB
        break;

      case 'TOTAL_DOWNLOADED':
        if (!this.validateNumericCondition(condition, 'TOTAL_DOWNLOADED')) {
          return false;
        }
        conditionValue = (torrent.total_downloaded || 0) / (1024 * 1024); // MB
        break;

      // ===== Content & Metadata (Direct from API) =====
      case 'FILE_SIZE':
        if (!this.validateNumericCondition(condition, 'FILE_SIZE')) {
          return false;
        }
        conditionValue = (torrent.size || 0) / (1024 * 1024); // MB
        break;

      case 'FILE_COUNT':
        if (!this.validateNumericCondition(condition, 'FILE_COUNT')) {
          return false;
        }
        conditionValue = torrent.files?.length || 0;
        break;

      case 'NAME':
        // NAME condition: supports string operators (contains, equals, starts_with, ends_with, etc.)
        if (!this.validateStringCondition(condition, 'NAME')) {
          return false;
        }
        return this.compareStringValues(torrent.name, condition.operator, condition.value);

      case 'TRACKER':
        // TRACKER condition: supports string operators (contains, equals, starts_with, ends_with, etc.)
        if (!this.validateStringCondition(condition, 'TRACKER')) {
          return false;
        }
        return this.compareStringValues(torrent.tracker, condition.operator, condition.value);

      case 'PRIVATE':
        const isPrivate = this.normalizeBooleanValue(torrent.private);
        return this.evaluateBooleanCondition(isPrivate, condition);

      case 'CACHED':
        const isCached = this.normalizeBooleanValue(torrent.cached);
        return this.evaluateBooleanCondition(isCached, condition);

      case 'AVAILABILITY':
        if (!this.validateNumericCondition(condition, 'AVAILABILITY')) {
          return false;
        }
        conditionValue = torrent.availability || 0;
        break;

      case 'ALLOW_ZIP':
        const allowZip = this.normalizeBooleanValue(torrent.allow_zipped);
        return this.evaluateBooleanCondition(allowZip, condition);

      // ===== Lifecycle (Derived or Direct) =====
      case 'IS_ACTIVE':
        const isActive = this.normalizeBooleanValue(torrent.active);
        return this.evaluateBooleanCondition(isActive, condition);

      case 'SEEDING_ENABLED':
        // Maps to seed_torrent field
        const seedingEnabled = this.normalizeBooleanValue(torrent.seed_torrent);
        return this.evaluateBooleanCondition(seedingEnabled, condition);

      case 'LONG_TERM_SEEDING':
        const longTermSeeding = this.normalizeBooleanValue(torrent.long_term_seeding);
        return this.evaluateBooleanCondition(longTermSeeding, condition);

      case 'STATUS':
        const torrentStatus = this.getTorrentStatus(torrent);
        // STATUS value must be an array
        if (!Array.isArray(condition.value)) {
          logger.debug('STATUS condition has invalid value (not an array)', {
            torrentId: torrent.id,
            conditionValue: condition.value
          });
          return false;
        }
        
        // Support both frontend operators (is_any_of, is_none_of) and implicit behavior
        const operator = condition.operator || 'is_any_of'; // Default to is_any_of for backward compatibility
        const statusMatches = condition.value.length > 0 && condition.value.includes(torrentStatus);
        
        switch (operator) {
          case 'is_any_of':
            return statusMatches;
          case 'is_none_of':
            return !statusMatches;
          default:
            // For backward compatibility, default to is_any_of behavior
            return statusMatches;
        }

      case 'EXPIRES_AT':
        if (!this.validateNumericCondition(condition, 'EXPIRES_AT')) {
          return false;
        }
        if (!torrent.expires_at) {
          return false;
        }
        const expiresAt = new Date(torrent.expires_at);
        // Calculate hours until expiration (positive = future, negative = past/expired)
        conditionValue = (expiresAt.getTime() - now) / (1000 * 60 * 60);
        // If already expired (negative value), return false for positive comparisons
        // This makes "expires in less than X hours" not match expired torrents
        if (conditionValue < 0 && (condition.operator === 'gt' || condition.operator === 'gte')) {
          return false;
        }
        break;

      case 'TAGS':
        // Validate value is an array
        if (!Array.isArray(condition.value)) {
          logger.debug('TAGS condition has invalid value (not an array)', {
            torrentId: torrent.id,
            conditionValue: condition.value
          });
          return false;
        }

        // Validate operator exists
        if (!condition.operator) {
          logger.debug('TAGS condition missing operator', {
            torrentId: torrent.id,
            condition: JSON.stringify(condition)
          });
          return false;
        }

        // Get tags for this download
        const downloadId = torrent.id?.toString() || torrent.torrent_id?.toString() || 
                          torrent.usenet_id?.toString() || torrent.web_id?.toString();
        
        if (!downloadId) {
          return false;
        }

        // Use pre-loaded tags from map (avoid N+1 queries)
        const downloadTags = tagsByDownloadId.get(downloadId) || [];
        const downloadTagIds = downloadTags.map(tag => tag.id);
        const conditionTagIds = condition.value.map(v => typeof v === 'number' ? v : parseInt(v, 10)).filter(id => !isNaN(id));

        if (conditionTagIds.length === 0) {
          return true; // No tags specified means match all
        }

        // Support both frontend operators (is_any_of, is_all_of, is_none_of) and backend operators (has_any, has_all, has_none)
        switch (condition.operator) {
          case 'has_any':
          case 'is_any_of':
            // Download must have at least one of the specified tags
            return conditionTagIds.some(tagId => downloadTagIds.includes(tagId));
          case 'has_all':
          case 'is_all_of':
            // Download must have all of the specified tags
            return conditionTagIds.every(tagId => downloadTagIds.includes(tagId));
          case 'has_none':
          case 'is_none_of':
            // Download must have none of the specified tags
            return !conditionTagIds.some(tagId => downloadTagIds.includes(tagId));
          default:
            logger.debug('TAGS condition has invalid operator', {
              torrentId: torrent.id,
              operator: condition.operator,
              condition: JSON.stringify(condition)
            });
            return false;
        }

      default:
        logger.warn('Unknown condition type in rule evaluation', {
          conditionType: condition.type,
          condition: JSON.stringify(condition),
          torrentId: torrent.id
        });
        return false;
    }

    return this.compareValues(conditionValue, condition.operator, condition.value);
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
      const hoursAgo = new Date(now - hours * 60 * 60 * 1000);
      
      // Filter samples within the time window
      samples = allSamples.filter(sample => 
        new Date(sample.timestamp) >= hoursAgo
      );
    } else {
      // Fallback to database query (for backward compatibility)
      const now = new Date();
      const hoursAgo = new Date(now - hours * 60 * 60 * 1000);

      samples = this.db.prepare(`
        SELECT * FROM speed_history
        WHERE torrent_id = ? AND timestamp >= ?
        ORDER BY timestamp ASC
      `).all(torrentId, hoursAgo.toISOString());
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
        condition: JSON.stringify(condition)
      });
      return false;
    }
    
    if (condition.value === undefined || condition.value === null) {
      logger.debug('Numeric condition missing value', {
        conditionType,
        operator: condition.operator,
        condition: JSON.stringify(condition)
      });
      return false;
    }
    
    if (!this.isValidNumericOperator(condition.operator)) {
      logger.debug('Numeric condition has invalid operator', {
        conditionType,
        operator: condition.operator,
        condition: JSON.stringify(condition)
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
        condition: JSON.stringify(condition)
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
          conditionValue
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
        value2
      });
      return false;
    }

    switch (operator) {
      case 'gt': return value1 > value2;
      case 'lt': return value1 < value2;
      case 'gte': return value1 >= value2;
      case 'lte': return value1 <= value2;
      case 'eq': return value1 === value2;
      default: return false;
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
      const existing = this.db.prepare(`
        SELECT id FROM archived_downloads WHERE torrent_id = ?
      `).get(id);

      if (existing) {
        logger.debug('Download already archived, skipping', { torrentId: id });
        return { success: true, message: 'Already archived' };
      }

      // Insert new archive entry
      this.db.prepare(`
        INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id, hash, tracker || null, name || null);

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
      throw new Error(`Action type is required but was not provided. Action: ${JSON.stringify(action)}`);
    }

    switch (action.type) {
      // TorBox API Actions 
      case 'stop_seeding':
        return await this.apiClient.controlTorrent(torrent.id, 'stop_seeding');
      
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
    const downloadId = torrent.id?.toString() || torrent.torrent_id?.toString() || 
                      torrent.usenet_id?.toString() || torrent.web_id?.toString();
    
    if (!downloadId) {
      throw new Error('Download ID is required but could not be extracted from torrent');
    }

    // Validate all tag IDs exist
    const placeholders = action.tagIds.map(() => '?').join(',');
    const existingTags = this.db.prepare(`
      SELECT id FROM tags WHERE id IN (${placeholders})
    `).all(...action.tagIds);

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
      tagCount: action.tagIds.length
    });

    return { success: true, message: `Added ${action.tagIds.length} tag(s) to download` };
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
    const downloadId = torrent.id?.toString() || torrent.torrent_id?.toString() || 
                      torrent.usenet_id?.toString() || torrent.web_id?.toString();
    
    if (!downloadId) {
      throw new Error('Download ID is required but could not be extracted from torrent');
    }

    // Validate all tag IDs exist
    const placeholders = action.tagIds.map(() => '?').join(',');
    const existingTags = this.db.prepare(`
      SELECT id FROM tags WHERE id IN (${placeholders})
    `).all(...action.tagIds);

    if (existingTags.length !== action.tagIds.length) {
      throw new Error('One or more tag IDs are invalid');
    }

    // Remove tags using transaction
    const transaction = this.db.transaction(() => {
      const tagPlaceholders = action.tagIds.map(() => '?').join(',');
      this.db.prepare(`
        DELETE FROM download_tags 
        WHERE download_id = ? 
          AND tag_id IN (${tagPlaceholders})
      `).run(downloadId, ...action.tagIds);
    });

    transaction();

    logger.debug('Tags removed from download', {
      downloadId,
      tagIds: action.tagIds,
      tagCount: action.tagIds.length
    });

    return { success: true, message: `Removed ${action.tagIds.length} tag(s) from download` };
  }
}

export default RuleEvaluator;

