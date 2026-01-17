import logger from '../utils/logger.js';

/**
 * Speed Aggregator
 * Maintains per-poll speed samples for active torrents
 * Aggregates samples into hourly averages for condition evaluation
 */
class SpeedAggregator {
  // Constants
  static RETENTION_HOURS = 24; // Keep last 24 hours of data to support flexible hour windows
  static PRUNE_INTERVAL = 10; // Prune every Nth sample to avoid overhead
  static MS_PER_HOUR = 60 * 60 * 1000;
  static MS_PER_SECOND = 1000;
  static MIN_SAMPLES_FOR_CALCULATION = 2;

  // Speed type constants
  static SPEED_TYPE = {
    DOWNLOAD: 'download',
    UPLOAD: 'upload',
  };

  // Field mappings
  static FIELD_MAP = {
    [SpeedAggregator.SPEED_TYPE.DOWNLOAD]: 'total_downloaded',
    [SpeedAggregator.SPEED_TYPE.UPLOAD]: 'total_uploaded',
  };

  constructor(userDb) {
    if (!userDb) {
      throw new Error('userDb is required for SpeedAggregator');
    }
    this.db = userDb;
    this.retentionHours = SpeedAggregator.RETENTION_HOURS;
    this.sampleCount = 0; // Counter for pruning logic

    // Prepare and cache SQL statements for better performance
    this._prepareStatements();
  }

  /**
   * Prepare and cache SQL statements
   * @private
   */
  _prepareStatements() {
    this.stmtInsert = this.db.prepare(`
      INSERT INTO speed_history (torrent_id, timestamp, total_downloaded, total_uploaded)
      VALUES (?, ?, ?, ?)
    `);

    this.stmtSelectSamples = this.db.prepare(`
      SELECT * FROM speed_history
      WHERE torrent_id = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `);

    this.stmtDeleteOld = this.db.prepare(`
      DELETE FROM speed_history
      WHERE timestamp < ?
    `);
  }

  /**
   * Record a speed sample (only for active torrents)
   * @param {string} torrentId - Torrent ID
   * @param {number} totalDownloaded - Total downloaded bytes
   * @param {number} totalUploaded - Total uploaded bytes
   * @param {Date} timestamp - Sample timestamp
   */
  async recordSample(torrentId, totalDownloaded, totalUploaded, timestamp) {
    // Validate inputs
    if (!torrentId) {
      logger.warn('Skipping speed sample: missing torrentId');
      return;
    }

    if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
      logger.warn('Skipping speed sample: invalid timestamp', { torrentId });
      return;
    }

    // Ensure values are numbers
    const downloaded = Number(totalDownloaded) || 0;
    const uploaded = Number(totalUploaded) || 0;

    try {
      this.stmtInsert.run(torrentId, timestamp.toISOString(), downloaded, uploaded);

      // Prune old samples periodically (every Nth sample to avoid overhead)
      this.sampleCount++;
      if (this.sampleCount >= SpeedAggregator.PRUNE_INTERVAL) {
        this.sampleCount = 0;
        await this.pruneOldSamples();
      }
    } catch (error) {
      // Log error but don't throw - speed recording is not critical
      logger.warn('Failed to record speed sample', error, {
        torrentId,
        errorMessage: error.message,
      });
      // Don't throw - speed recording failures shouldn't break the poll cycle
    }
  }

  /**
   * Get average speed for a torrent over a specified number of hours
   * @param {string} torrentId - Torrent ID
   * @param {number} hours - Number of hours to calculate average over
   * @param {string} type - 'download' or 'upload'
   * @returns {number} - Average speed in bytes per second
   */
  getAverageSpeed(torrentId, hours, type = SpeedAggregator.SPEED_TYPE.DOWNLOAD) {
    if (!torrentId) {
      return 0;
    }

    if (hours <= 0 || !isFinite(hours)) {
      logger.warn('Invalid hours parameter for getAverageSpeed', { torrentId, hours });
      return 0;
    }

    try {
      const cutoffTime = this._getHoursAgo(hours);
      const samples = this.stmtSelectSamples.all(torrentId, cutoffTime.toISOString());
      const field = this._getFieldForType(type);

      return this.calculateAverageSpeed(samples, field);
    } catch (error) {
      logger.warn('Failed to get average speed', error, {
        torrentId,
        hours,
        type,
        errorMessage: error.message,
      });
      return 0;
    }
  }

  /**
   * Calculate average speed from samples
   * @param {Array} samples - Array of speed history records
   * @param {string} field - Field name to calculate speed for ('total_downloaded' or 'total_uploaded')
   * @returns {number} - Average speed in bytes per second
   */
  calculateAverageSpeed(samples, field) {
    if (samples.length < SpeedAggregator.MIN_SAMPLES_FOR_CALCULATION) {
      return 0;
    }

    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDelta = this._getTimeDeltaSeconds(first.timestamp, last.timestamp);

    if (timeDelta === 0) {
      return 0;
    }

    const valueDelta = last[field] - first[field];
    return valueDelta / timeDelta; // bytes per second
  }

  /**
   * Calculate max speed from samples
   * @param {Array} samples - Array of speed history records
   * @param {string} field - Field name to calculate speed for ('total_downloaded' or 'total_uploaded')
   * @returns {number} - Maximum speed in bytes per second
   */
  calculateMaxSpeed(samples, field) {
    if (samples.length < SpeedAggregator.MIN_SAMPLES_FOR_CALCULATION) {
      return 0;
    }

    let maxSpeed = 0;
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const timeDelta = this._getTimeDeltaSeconds(prev.timestamp, curr.timestamp);

      if (timeDelta > 0) {
        const speed = (curr[field] - prev[field]) / timeDelta;
        maxSpeed = Math.max(maxSpeed, speed);
      }
    }

    return maxSpeed;
  }

  /**
   * Prune old samples (keep only last N hours)
   * @returns {Promise<void>}
   */
  async pruneOldSamples() {
    try {
      const cutoff = this._getHoursAgo(this.retentionHours);
      const result = this.stmtDeleteOld.run(cutoff.toISOString());
      
      if (result.changes > 0) {
        logger.verbose('Pruned old speed samples', {
          deletedCount: result.changes,
          cutoffTime: cutoff.toISOString(),
        });
      }
    } catch (error) {
      logger.warn('Failed to prune old speed samples', error, {
        errorMessage: error.message,
      });
      // Don't throw - pruning is not critical
    }
  }

  /**
   * Process torrent updates and record samples (only for active torrents)
   * @param {Array} updatedTorrents - Torrents with changes
   * @returns {Promise<void>}
   */
  async processUpdates(updatedTorrents) {
    if (!Array.isArray(updatedTorrents) || updatedTorrents.length === 0) {
      return;
    }

    const now = new Date();
    let samplesRecorded = 0;
    let errors = 0;

    for (const { torrent } of updatedTorrents) {
      if (!torrent || !torrent.id) {
        continue;
      }

      if (this._isTorrentActive(torrent)) {
        try {
          await this.recordSample(
            torrent.id,
            torrent.total_downloaded || 0,
            torrent.total_uploaded || 0,
            now
          );
          samplesRecorded++;
        } catch (error) {
          errors++;
          // Error already logged in recordSample
        }
      }
    }

    if (samplesRecorded > 0 || errors > 0) {
      logger.verbose('Processed speed updates', {
        totalTorrents: updatedTorrents.length,
        samplesRecorded,
        errors,
      });
    }
  }

  /**
   * Check if a torrent is active
   * @param {Object} torrent - Torrent object
   * @returns {boolean} - True if torrent is active
   * @private
   */
  _isTorrentActive(torrent) {
    return torrent.active === true || torrent.active === 1 || torrent.active === 'true';
  }

  /**
   * Get timestamp N hours ago from now
   * @param {number} hours - Number of hours
   * @returns {Date} - Timestamp N hours ago
   * @private
   */
  _getHoursAgo(hours) {
    return new Date(Date.now() - hours * SpeedAggregator.MS_PER_HOUR);
  }

  /**
   * Calculate time delta in seconds between two timestamps
   * @param {string|Date} timestamp1 - First timestamp
   * @param {string|Date} timestamp2 - Second timestamp
   * @returns {number} - Time delta in seconds
   * @private
   */
  _getTimeDeltaSeconds(timestamp1, timestamp2) {
    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    return (date2 - date1) / SpeedAggregator.MS_PER_SECOND;
  }

  /**
   * Get field name for speed type
   * @param {string} type - Speed type ('download' or 'upload')
   * @returns {string} - Field name
   * @private
   */
  _getFieldForType(type) {
    return (
      SpeedAggregator.FIELD_MAP[type] ||
      SpeedAggregator.FIELD_MAP[SpeedAggregator.SPEED_TYPE.DOWNLOAD]
    );
  }
}

export default SpeedAggregator;
