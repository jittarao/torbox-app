class SnapshotManager {
  constructor(database) {
    this.database = database;
    
    // Terminal states that don't need frequent snapshots
    this.terminalStates = ['completed', 'failed', 'expired'];
  }

  /**
   * Determine if a snapshot should be created
   */
  async shouldCreateSnapshot(userId, item, lastSnapshot) {
    const state = this.getTorrentState(item);
    
    // Always snapshot if it's the first time seeing this torrent
    if (!lastSnapshot) {
      return true;
    }

    // Always snapshot if state changed
    if (lastSnapshot.state !== state) {
      return true;
    }

    // For terminal states, only snapshot if state changed
    if (this.terminalStates.includes(state)) {
      return false;
    }

    // For active states, always snapshot (they change frequently)
    return true;
  }

  /**
   * Get torrent state from item
   */
  getTorrentState(item) {
    // Check if queued (no download_state)
    if (!item.download_state) {
      return 'queued';
    }

    // Map TorBox states to our states
    const stateMap = {
      'downloading': 'downloading',
      'uploading': 'seeding',
      'uploading (no peers)': 'stalled',
      'completed': 'completed',
      'failed': 'failed',
      'expired': 'expired',
    };

    return stateMap[item.download_state] || item.download_state;
  }

  /**
   * Create snapshot data object
   */
  createSnapshotData(userId, item) {
    const state = this.getTorrentState(item);
    
    return {
      user_id: userId,
      torrent_id: item.id,
      snapshot_data: item, // Full item data as JSONB
      state: state,
      progress: item.progress || 0,
      download_speed: item.download_speed || 0,
      upload_speed: item.upload_speed || 0,
      seeds: item.seeds || 0,
      peers: item.peers || 0,
      ratio: item.ratio || 0,
      created_at: new Date(),
    };
  }

  /**
   * Get last snapshot for each torrent
   */
  async getLastSnapshots(userId, torrentIds) {
    if (torrentIds.length === 0) {
      return {};
    }

    // Get the most recent snapshot for each torrent
    const snapshots = await this.database.queryAll(
      `SELECT DISTINCT ON (torrent_id) 
         torrent_id, state, created_at
       FROM torrent_snapshots
       WHERE user_id = $1 AND torrent_id = ANY($2)
       ORDER BY torrent_id, created_at DESC`,
      [userId, torrentIds]
    );

    const result = {};
    for (const snapshot of snapshots) {
      result[snapshot.torrent_id] = snapshot;
    }

    return result;
  }

  /**
   * Calculate metrics from snapshots
   */
  async calculateMetrics(userId, torrentId) {
    const snapshots = await this.database.queryAll(
      `SELECT state, progress, created_at
       FROM torrent_snapshots
       WHERE user_id = $1 AND torrent_id = $2
       ORDER BY created_at ASC`,
      [userId, torrentId]
    );

    if (snapshots.length === 0) {
      return {
        stalled_time_hours: 0,
        seeding_time_hours: 0,
        stuck_progress: false,
        queued_count: 0,
      };
    }

    let stalledTimeMs = 0;
    let seedingTimeMs = 0;
    let queuedCount = 0;
    let lastProgress = null;
    let stuckProgress = false;

    let lastStalledAt = null;
    let lastSeedingAt = null;

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      const createdAt = new Date(snapshot.created_at);

      // Track stalled time
      if (snapshot.state === 'stalled') {
        if (lastStalledAt === null) {
          lastStalledAt = createdAt;
        }
      } else {
        if (lastStalledAt !== null) {
          stalledTimeMs += createdAt - lastStalledAt;
          lastStalledAt = null;
        }
      }

      // Track seeding time
      if (snapshot.state === 'seeding') {
        if (lastSeedingAt === null) {
          lastSeedingAt = createdAt;
        }
      } else {
        if (lastSeedingAt !== null) {
          seedingTimeMs += createdAt - lastSeedingAt;
          lastSeedingAt = null;
        }
      }

      // Track queued count
      if (snapshot.state === 'queued') {
        queuedCount++;
      }

      // Check for stuck progress
      if (snapshot.progress !== null && snapshot.progress !== undefined) {
        if (lastProgress !== null && lastProgress === snapshot.progress) {
          // Check if progress hasn't changed for more than 2 hours
          if (i > 0) {
            const timeDiff = createdAt - new Date(snapshots[i - 1].created_at);
            if (timeDiff > 2 * 60 * 60 * 1000) {
              stuckProgress = true;
            }
          }
        }
        lastProgress = snapshot.progress;
      }
    }

    // Handle case where last snapshot is still in stalled/seeding state
    if (lastStalledAt !== null && snapshots.length > 0) {
      const now = new Date();
      stalledTimeMs += now - lastStalledAt;
    }
    if (lastSeedingAt !== null && snapshots.length > 0) {
      const now = new Date();
      seedingTimeMs += now - lastSeedingAt;
    }

    return {
      stalled_time_hours: stalledTimeMs / (1000 * 60 * 60),
      seeding_time_hours: seedingTimeMs / (1000 * 60 * 60),
      stuck_progress: stuckProgress,
      queued_count: queuedCount,
    };
  }

  /**
   * Cleanup old snapshots based on retention period
   */
  async cleanupOldSnapshots() {
    const retentionDays = parseInt(
      process.env.SNAPSHOT_RETENTION_DAYS || '30',
      10
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Delete in batches to avoid long locks
    let deletedCount = 0;
    const batchSize = 1000;

    while (true) {
      const result = await this.database.query(
        `DELETE FROM torrent_snapshots
         WHERE created_at < $1
         AND id IN (
           SELECT id FROM torrent_snapshots
           WHERE created_at < $1
           LIMIT $2
         )`,
        [cutoffDate, batchSize]
      );

      deletedCount += result.rowCount;

      if (result.rowCount < batchSize) {
        break;
      }
    }

    console.log(`Cleaned up ${deletedCount} old snapshots (older than ${retentionDays} days)`);
    return deletedCount;
  }
}

export default SnapshotManager;

