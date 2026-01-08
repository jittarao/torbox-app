/**
 * Speed Aggregator
 * Maintains per-poll speed samples for active torrents
 * Aggregates samples into hourly averages for condition evaluation
 */
class SpeedAggregator {
  constructor(userDb) {
    this.db = userDb;
    this.retentionHours = 24; // Keep last 24 hours of data to support flexible hour windows
  }

  /**
   * Record a speed sample (only for active torrents)
   * @param {string} torrentId - Torrent ID
   * @param {number} totalDownloaded - Total downloaded bytes
   * @param {number} totalUploaded - Total uploaded bytes
   * @param {Date} timestamp - Sample timestamp
   */
  async recordSample(torrentId, totalDownloaded, totalUploaded, timestamp) {
    this.db.prepare(`
      INSERT INTO speed_history (torrent_id, timestamp, total_downloaded, total_uploaded)
      VALUES (?, ?, ?, ?)
    `).run(torrentId, timestamp.toISOString(), totalDownloaded, totalUploaded);

    // Prune old samples periodically (every 10th sample to avoid overhead)
    if (Math.random() < 0.1) {
      await this.pruneOldSamples();
    }
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
   * Calculate average speed from samples
   */
  calculateAverageSpeed(samples, field) {
    if (samples.length < 2) {
      return 0;
    }

    // Calculate delta over time
    const first = samples[0];
    const last = samples[samples.length - 1];
    const timeDelta = (new Date(last.timestamp) - new Date(first.timestamp)) / 1000; // seconds
    
    if (timeDelta === 0) {
      return 0;
    }

    const valueDelta = last[field] - first[field];
    return valueDelta / timeDelta; // bytes per second
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
   * Prune old samples (keep only last N hours)
   */
  async pruneOldSamples() {
    const cutoff = new Date(Date.now() - this.retentionHours * 60 * 60 * 1000);
    this.db.prepare(`
      DELETE FROM speed_history
      WHERE timestamp < ?
    `).run(cutoff.toISOString());
  }

  /**
   * Process torrent updates and record samples (only for active torrents)
   * @param {Array} updatedTorrents - Torrents with changes
   */
  async processUpdates(updatedTorrents) {
    const now = new Date();
    
    for (const { torrent } of updatedTorrents) {
      // Only record samples for active torrents
      const isActive = torrent.active === true || torrent.active === 1 || torrent.active === 'true';
      if (isActive) {
        await this.recordSample(
          torrent.id,
          torrent.total_downloaded || 0,
          torrent.total_uploaded || 0,
          now
        );
      }
    }
  }
}

export default SpeedAggregator;

