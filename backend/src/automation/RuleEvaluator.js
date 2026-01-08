import { getTorrentStatus as getTorrentStatusUtil } from '../utils/torrentStatus.js';

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
   * @param {Object} rule - Rule configuration
   * @param {Array} torrents - Current torrents from API
   * @returns {Promise<Array>} - Matching torrents
   */
  async evaluateRule(rule, torrents) {
    if (!rule.enabled) {
      return [];
    }

    // Check cooldown
    if (rule.cooldown_minutes && rule.last_executed_at) {
      const lastExecuted = new Date(rule.last_executed_at);
      const cooldownMs = rule.cooldown_minutes * 60 * 1000;
      const timeSinceLastExecution = Date.now() - lastExecuted.getTime();
      
      if (timeSinceLastExecution < cooldownMs) {
        return []; // Still in cooldown
      }
    }

    const conditions = rule.conditions || [];
    const logicOperator = rule.logicOperator || 'and';

    const matchingTorrents = torrents.filter(torrent => {
      const conditionResults = conditions.map(condition => {
        return this.evaluateCondition(condition, torrent);
      });

      // Apply logic operator
      if (logicOperator === 'or') {
        return conditionResults.some(result => result);
      } else {
        return conditionResults.every(result => result);
      }
    });

    return matchingTorrents;
  }

  /**
   * Evaluate a single condition
   */
  evaluateCondition(condition, torrent) {
    const now = Date.now();
    let conditionValue = 0;

    // Get telemetry for derived fields
    const telemetry = this.db.prepare(`
      SELECT * FROM torrent_telemetry WHERE torrent_id = ?
    `).get(torrent.id);

    switch (condition.type) {
      // ===== Time / State (Derived) =====
      case 'SEEDING_TIME':
        if (!torrent.cached_at) {
          return false;
        }
        const cachedAt = new Date(torrent.cached_at);
        conditionValue = (now - cachedAt.getTime()) / (1000 * 60 * 60); // hours
        break;

      case 'AGE':
        if (torrent.created_at) {
          conditionValue = (now - new Date(torrent.created_at).getTime()) / (1000 * 60 * 60); // hours
        }
        break;

      case 'LAST_DOWNLOAD_ACTIVITY_AT':
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
          conditionValue = (now - lastDownloadActivity.getTime()) / (1000 * 60); // minutes
        }
        break;

      case 'LAST_UPLOAD_ACTIVITY_AT':
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
          conditionValue = (now - lastUploadActivity.getTime()) / (1000 * 60); // minutes
        }
        break;

      // ===== Progress & Performance (Direct from API) =====
      case 'PROGRESS':
        conditionValue = torrent.progress || 0;
        break;

      case 'DOWNLOAD_SPEED':
        // Convert from bytes/s to MB/s
        conditionValue = (torrent.download_speed || 0) / (1024 * 1024);
        break;

      case 'UPLOAD_SPEED':
        // Convert from bytes/s to MB/s
        conditionValue = (torrent.upload_speed || 0) / (1024 * 1024);
        break;

      case 'AVG_DOWNLOAD_SPEED':
        // Get hours parameter (default to 1 hour if not specified)
        const downloadHours = condition.hours || 1;
        // Get average speed using SpeedAggregator
        const avgDownloadSpeed = this.getAverageSpeed(torrent.id, downloadHours, 'download');
        // Convert from bytes/s to MB/s
        conditionValue = (avgDownloadSpeed || 0) / (1024 * 1024);
        break;

      case 'AVG_UPLOAD_SPEED':
        // Get hours parameter (default to 1 hour if not specified)
        const uploadHours = condition.hours || 1;
        // Get average speed using SpeedAggregator
        const avgUploadSpeed = this.getAverageSpeed(torrent.id, uploadHours, 'upload');
        // Convert from bytes/s to MB/s
        conditionValue = (avgUploadSpeed || 0) / (1024 * 1024);
        break;

      case 'ETA':
        conditionValue = torrent.eta || 0; // ETA from API is in seconds
        // Convert condition.value from minutes to seconds for comparison
        const etaConditionValueInSeconds = (condition.value || 0) * 60;
        return this.compareValues(conditionValue, condition.operator, etaConditionValueInSeconds);

      // ===== Stall & Inactivity (Derived) =====
      case 'DOWNLOAD_STALLED_TIME':
        if (!telemetry || !telemetry.stalled_since) {
          return false;
        }
        const stalledSince = new Date(telemetry.stalled_since);
        conditionValue = (now - stalledSince.getTime()) / (1000 * 60); // minutes
        break;

      case 'UPLOAD_STALLED_TIME':
        if (!telemetry || !telemetry.upload_stalled_since) {
          return false;
        }
        const uploadStalledSince = new Date(telemetry.upload_stalled_since);
        conditionValue = (now - uploadStalledSince.getTime()) / (1000 * 60); // minutes
        break;

      // ===== Swarm & Ratio (Direct from API) =====
      case 'SEEDS':
        conditionValue = torrent.seeds || 0;
        break;

      case 'PEERS':
        conditionValue = torrent.peers || 0;
        break;

      case 'RATIO':
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
        conditionValue = (torrent.total_uploaded || 0) / (1024 * 1024); // MB
        break;

      case 'TOTAL_DOWNLOADED':
        conditionValue = (torrent.total_downloaded || 0) / (1024 * 1024); // MB
        break;

      // ===== Content & Metadata (Direct from API) =====
      case 'FILE_SIZE':
        conditionValue = (torrent.size || 0) / (1024 * 1024); // MB
        break;

      case 'FILE_COUNT':
        conditionValue = torrent.files?.length || 0;
        break;

      case 'NAME':
        const nameMatch = torrent.name && torrent.name.toLowerCase().includes(condition.value.toLowerCase());
        return nameMatch;

      case 'PRIVATE':
        // Handle boolean comparison
        const isPrivate = torrent.private === true || torrent.private === 1 || torrent.private === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = isPrivate ? 1 : 0;
        } else {
          // Direct boolean match
          return isPrivate === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      case 'CACHED':
        // Handle boolean comparison
        const isCached = torrent.cached === true || torrent.cached === 1 || torrent.cached === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = isCached ? 1 : 0;
        } else {
          // Direct boolean match
          return isCached === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      case 'AVAILABILITY':
        conditionValue = torrent.availability || 0;
        break;

      case 'ALLOW_ZIP':
        // Handle boolean comparison
        const allowZip = torrent.allow_zipped === true || torrent.allow_zipped === 1 || torrent.allow_zipped === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = allowZip ? 1 : 0;
        } else {
          // Direct boolean match
          return allowZip === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      // ===== Lifecycle (Derived or Direct) =====
      case 'IS_ACTIVE':
        // Handle boolean comparison
        const isActive = torrent.active === true || torrent.active === 1 || torrent.active === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = isActive ? 1 : 0;
        } else {
          // Direct boolean match
          return isActive === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      case 'SEEDING_ENABLED':
        // Handle boolean comparison (maps to seed_torrent)
        const seedingEnabled = torrent.seed_torrent === true || torrent.seed_torrent === 1 || torrent.seed_torrent === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = seedingEnabled ? 1 : 0;
        } else {
          // Direct boolean match
          return seedingEnabled === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      case 'LONG_TERM_SEEDING':
        // Handle boolean comparison
        const longTermSeeding = torrent.long_term_seeding === true || torrent.long_term_seeding === 1 || torrent.long_term_seeding === 'true';
        if (condition.operator) {
          // If operator is provided, treat as numeric comparison (0/1)
          conditionValue = longTermSeeding ? 1 : 0;
        } else {
          // Direct boolean match
          return longTermSeeding === (condition.value === true || condition.value === 1 || condition.value === 'true');
        }
        break;

      case 'STATUS':
        const torrentStatus = this.getTorrentStatus(torrent);
        // STATUS value must be an array
        if (!Array.isArray(condition.value)) {
          return false;
        }
        return condition.value.length > 0 && condition.value.includes(torrentStatus);

      case 'EXPIRES_AT':
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

      default:
        return false;
    }

    return this.compareValues(conditionValue, condition.operator, condition.value);
  }

  /**
   * Get average speed for a torrent over a specified number of hours
   * @param {string} torrentId - Torrent ID
   * @param {number} hours - Number of hours to calculate average over
   * @param {string} type - 'download' or 'upload'
   * @returns {number} - Average speed in bytes per second
   */
  getAverageSpeed(torrentId, hours, type = 'download') {
    const now = new Date();
    const hoursAgo = new Date(now - hours * 60 * 60 * 1000);

    const samples = this.db.prepare(`
      SELECT * FROM speed_history
      WHERE torrent_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `).all(torrentId, hoursAgo.toISOString());

    const field = type === 'download' ? 'total_downloaded' : 'total_uploaded';
    return this.calculateAverageSpeed(samples, field);
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
   * Compare values with operator
   */
  compareValues(value1, operator, value2) {
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
        console.log(`Download ${id} already archived, skipping`);
        return { success: true, message: 'Already archived' };
      }

      // Insert new archive entry
      this.db.prepare(`
        INSERT INTO archived_downloads (torrent_id, hash, tracker, name, archived_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(id, hash, tracker || null, name || null);

      return { success: true, message: 'Download archived successfully' };
    } catch (error) {
      console.error(`Error archiving download ${torrent.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute action on a torrent
   */
  async executeAction(action, torrent) {
    switch (action.type) {
      case 'stop_seeding':
        return await this.apiClient.controlTorrent(torrent.id, 'stop_seeding');
        
      case 'archive':
        await this.archiveDownload(torrent);
        return await this.apiClient.deleteTorrent(torrent.id);
        
      case 'delete':
        return await this.apiClient.deleteTorrent(torrent.id);
        
      case 'pause':
        return await this.apiClient.controlTorrent(torrent.id, 'pause');
        
      case 'resume':
        return await this.apiClient.controlTorrent(torrent.id, 'resume');
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}

export default RuleEvaluator;

