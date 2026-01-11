import { getTorrentStatus } from '../utils/torrentStatus.js';

/**
 * Derived Fields Engine
 * Computes time-based derived fields from state diffs
 */
class DerivedFieldsEngine {
  constructor(userDb) {
    this.db = userDb;
  }

  /**
   * Update derived fields based on state changes
   * @param {Object} changes - Changes from StateDiffEngine
   * @param {number} pollIntervalSeconds - Poll interval in seconds
   */
  async updateDerivedFields(changes, pollIntervalSeconds = 300) {
    const now = new Date();

    // Process new torrents
    for (const torrent of changes.new) {
      await this.initializeTelemetry(torrent.id, torrent);
    }

    // Process updated torrents
    for (const { torrent, diff, shadow } of changes.updated) {
      await this.updateTelemetry(torrent, diff, shadow, now, pollIntervalSeconds);
    }

    // Process removed torrents (mark as inactive)
    for (const shadow of changes.removed) {
      // Keep telemetry for historical purposes, just mark as removed
      // Could optionally delete or archive
    }

    // Process state transitions
    for (const transition of changes.stateTransitions) {
      await this.handleStateTransition(transition, now);
    }
  }

  /**
   * Initialize telemetry for a new torrent
   */
  async initializeTelemetry(torrentId, torrent) {
    const state = this.getTorrentState(torrent);
    const now = new Date().toISOString();

    // Check if telemetry already exists
    const existing = this.db.prepare(`
      SELECT torrent_id FROM torrent_telemetry WHERE torrent_id = ?
    `).get(torrentId);

    if (existing) {
      return;
    }

    // Initialize based on current state
    if (state === 'downloading') {
      this.db.prepare(`
        INSERT INTO torrent_telemetry (
          torrent_id, last_download_activity_at
        ) VALUES (?, ?)
      `).run(torrentId, now);
    } else if (state === 'seeding') {
      this.db.prepare(`
        INSERT INTO torrent_telemetry (
          torrent_id, last_upload_activity_at
        ) VALUES (?, ?)
      `).run(torrentId, now);
    } else {
      this.db.prepare(`
        INSERT INTO torrent_telemetry (torrent_id)
        VALUES (?)
      `).run(torrentId);
    }
  }

  /**
   * Update telemetry based on changes
   */
  async updateTelemetry(torrent, diff, shadow, now, pollIntervalSeconds) {
    const torrentId = torrent.id;
    const state = this.getTorrentState(torrent);

    // Get current telemetry
    let telemetry = this.db.prepare(`
      SELECT * FROM torrent_telemetry WHERE torrent_id = ?
    `).get(torrentId);

    if (!telemetry) {
      await this.initializeTelemetry(torrentId, torrent);
      telemetry = this.db.prepare(`
        SELECT * FROM torrent_telemetry WHERE torrent_id = ?
      `).get(torrentId);
    }

    const updates = {};
    const nowISO = now.toISOString();

    // Update activity timestamps
    if (diff.downloadChanged && diff.downloadDelta > 0) {
      updates.last_download_activity_at = nowISO;
      
      // Clear stalled if download activity detected
      if (telemetry.stalled_since) {
        updates.stalled_since = null;
        updates.last_stall_resumed_at = nowISO;
      }
    }

    if (diff.uploadChanged && diff.uploadDelta > 0) {
      updates.last_upload_activity_at = nowISO;
    }

    // Check for stall condition (downloading but no activity)
    if ((state === 'downloading') && 
        diff.downloadChanged && diff.downloadDelta === 0 &&
        !telemetry.stalled_since) {
      // Check if we should mark as stalled
      const lastActivity = telemetry.last_download_activity_at 
        ? new Date(telemetry.last_download_activity_at)
        : new Date(telemetry.created_at);
      const inactiveTime = (now - lastActivity) / 1000; // seconds
      
      // Mark as stalled if inactive for more than 5 minutes
      if (inactiveTime > 300) {
        updates.stalled_since = nowISO;
      }
    }

    // Check for upload stall condition (seeding but no upload activity)
    if (state === 'seeding' && 
        diff.uploadChanged && diff.uploadDelta === 0 &&
        !telemetry.upload_stalled_since) {
      // Check if we should mark as upload stalled
      const lastUploadActivity = telemetry.last_upload_activity_at 
        ? new Date(telemetry.last_upload_activity_at)
        : new Date(telemetry.created_at);
      const inactiveTime = (now - lastUploadActivity) / 1000; // seconds
      
      // Mark as upload stalled if inactive for more than 5 minutes
      if (inactiveTime > 300) {
        updates.upload_stalled_since = nowISO;
      }
    }

    // Clear upload stalled if upload activity detected
    if (diff.uploadChanged && diff.uploadDelta > 0 && telemetry.upload_stalled_since) {
      updates.upload_stalled_since = null;
    }

    // Apply updates with validated column names
    if (Object.keys(updates).length > 0) {
      // Whitelist of allowed column names for security
      const allowedColumns = [
        'last_download_activity_at',
        'stalled_since',
        'last_stall_resumed_at',
        'last_upload_activity_at',
        'upload_stalled_since'
      ];
      
      const setClause = Object.keys(updates)
        .filter(key => allowedColumns.includes(key))
        .map(key => `${key} = ?`)
        .join(', ');
      const values = Object.keys(updates)
        .filter(key => allowedColumns.includes(key))
        .map(key => updates[key]);
      values.push(torrentId);
      
      this.db.prepare(`
        UPDATE torrent_telemetry 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE torrent_id = ?
      `).run(...values);
    }
  }

  /**
   * Handle state transitions
   */
  async handleStateTransition(transition, now) {
    const { torrent_id, from, to } = transition;
    const nowISO = now.toISOString();

    const updates = {};

    // Detect download start
    if (from !== 'downloading' && to === 'downloading') {
      updates.last_download_activity_at = nowISO;
    }

    // Detect seeding start
    if (from !== 'seeding' && to === 'seeding') {
      updates.last_upload_activity_at = nowISO;
    }

    // Clear stalled when transitioning to active state
    if (to === 'downloading' || to === 'uploading' || to === 'seeding' || to === 'completed') {
      // Check if was stalled
      const telemetry = this.db.prepare(`
        SELECT stalled_since FROM torrent_telemetry WHERE torrent_id = ?
      `).get(torrent_id);
      
      if (telemetry && telemetry.stalled_since) {
        updates.stalled_since = null;
        updates.last_stall_resumed_at = nowISO;
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), torrent_id];

      this.db.prepare(`
        UPDATE torrent_telemetry 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE torrent_id = ?
      `).run(...values);
    }
  }

  /**
   * Get torrent state from API response
   */
  getTorrentState(torrent) {
    return getTorrentStatus(torrent);
  }

  /**
   * Get telemetry for a torrent
   */
  getTelemetry(torrentId) {
    return this.db.prepare(`
      SELECT * FROM torrent_telemetry WHERE torrent_id = ?
    `).get(torrentId);
  }
}

export default DerivedFieldsEngine;

