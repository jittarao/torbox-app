import { getTorrentStatus } from '../utils/torrentStatus.js';

/**
 * Constants for derived fields engine
 */
const STALL_THRESHOLD_SECONDS = 300; // 5 minutes
const ALLOWED_TELEMETRY_COLUMNS = [
  'last_download_activity_at',
  'stalled_since',
  'last_stall_resumed_at',
  'last_upload_activity_at',
  'upload_stalled_since',
];

/**
 * States stalled torrent can transition to
 */
const NOT_STALLED_STATES = ['downloading', 'uploading', 'seeding', 'completed'];

/**
 * Derived Fields Engine
 * Computes time-based derived fields from state diffs
 */
class DerivedFieldsEngine {
  /**
   * @param {Object} userDb - User database instance
   */
  constructor(userDb) {
    this.db = userDb;
    this._prepareStatements();
  }

  /**
   * Prepare and cache SQL statements for better performance
   * @private
   */
  _prepareStatements() {
    this.stmts = {
      getTelemetry: this.db.prepare(`
        SELECT * FROM torrent_telemetry WHERE torrent_id = ?
      `),
      getTelemetryExists: this.db.prepare(`
        SELECT torrent_id FROM torrent_telemetry WHERE torrent_id = ?
      `),
      getStalledSince: this.db.prepare(`
        SELECT stalled_since FROM torrent_telemetry WHERE torrent_id = ?
      `),
      insertTelemetry: this.db.prepare(`
        INSERT INTO torrent_telemetry (torrent_id, last_download_activity_at, last_upload_activity_at)
        VALUES (?, ?, ?)
      `),
      insertTelemetryMinimal: this.db.prepare(`
        INSERT INTO torrent_telemetry (torrent_id)
        VALUES (?)
      `),
    };
  }

  /**
   * Update derived fields based on state changes
   * @param {Object} changes - Changes from StateDiffEngine
   * @param {number} pollIntervalSeconds - Poll interval in seconds (unused, kept for API compatibility)
   */
  async updateDerivedFields(changes, pollIntervalSeconds = 300) {
    const now = new Date();

    // Process new torrents
    for (const torrent of changes.new) {
      await this.initializeTelemetry(torrent.id, torrent);
    }

    // Process updated torrents
    for (const { torrent, diff } of changes.updated) {
      await this.updateTelemetry(torrent, diff, now);
    }

    // Process removed torrents (keep telemetry for historical purposes)
    // Could optionally delete or archive in the future
    for (const shadow of changes.removed) {
      // No-op: telemetry is kept for historical purposes
    }

    // Process state transitions
    for (const transition of changes.stateTransitions) {
      await this.handleStateTransition(transition, now);
    }
  }

  /**
   * Initialize telemetry for a new torrent
   * @param {string} torrentId - Torrent ID
   * @param {Object} torrent - Torrent object from API
   */
  async initializeTelemetry(torrentId, torrent) {
    // Check if telemetry already exists
    const existing = this.stmts.getTelemetryExists.get(torrentId);
    if (existing) {
      return;
    }

    const state = this.getTorrentState(torrent);
    const now = new Date().toISOString();

    // Initialize based on current state
    if (state === 'downloading') {
      this.stmts.insertTelemetry.run(torrentId, now, null);
    } else if (state === 'seeding') {
      this.stmts.insertTelemetry.run(torrentId, null, now);
    } else {
      this.stmts.insertTelemetryMinimal.run(torrentId);
    }
  }

  /**
   * Update telemetry based on changes
   * @param {Object} torrent - Current torrent state
   * @param {Object} diff - State diff object
   * @param {Date} now - Current timestamp
   */
  async updateTelemetry(torrent, diff, now) {
    const torrentId = torrent.id;
    const state = this.getTorrentState(torrent);

    // Get or initialize telemetry
    let telemetry = this.stmts.getTelemetry.get(torrentId);
    if (!telemetry) {
      await this.initializeTelemetry(torrentId, torrent);
      telemetry = this.stmts.getTelemetry.get(torrentId);
    }

    const updates = this._computeTelemetryUpdates(telemetry, torrent, diff, state, now);

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      this._applyTelemetryUpdates(torrentId, updates);
    }
  }

  /**
   * Compute telemetry updates based on current state and changes
   * @param {Object} telemetry - Current telemetry record
   * @param {Object} torrent - Current torrent state
   * @param {Object} diff - State diff object
   * @param {string} state - Current torrent state
   * @param {Date} now - Current timestamp
   * @returns {Object} Updates object
   * @private
   */
  _computeTelemetryUpdates(telemetry, torrent, diff, state, now) {
    const updates = {};
    const nowISO = now.toISOString();

    // Handle download activity
    if (diff.downloadChanged && diff.downloadDelta > 0) {
      updates.last_download_activity_at = nowISO;
      this._clearStallIfActive(telemetry, updates, nowISO);
    }

    // Handle upload activity
    if (diff.uploadChanged && diff.uploadDelta > 0) {
      updates.last_upload_activity_at = nowISO;
      if (telemetry.upload_stalled_since) {
        updates.upload_stalled_since = null;
      }
    }

    // Check for download stall condition
    if (state === 'downloading' && this._shouldMarkAsStalled(telemetry, diff, 'download', now)) {
      updates.stalled_since = nowISO;
    }

    // Check for upload stall condition
    if (state === 'seeding' && this._shouldMarkAsStalled(telemetry, diff, 'upload', now)) {
      updates.upload_stalled_since = nowISO;
    }

    return updates;
  }

  /**
   * Clear stall markers if activity detected
   * @param {Object} telemetry - Current telemetry record
   * @param {Object} updates - Updates object to modify
   * @param {string} nowISO - Current timestamp as ISO string
   * @private
   */
  _clearStallIfActive(telemetry, updates, nowISO) {
    if (telemetry.stalled_since) {
      updates.stalled_since = null;
      updates.last_stall_resumed_at = nowISO;
    }
  }

  /**
   * Determine if torrent should be marked as stalled
   * @param {Object} telemetry - Current telemetry record
   * @param {Object} diff - State diff object
   * @param {string} type - 'download' or 'upload'
   * @param {Date} now - Current timestamp
   * @returns {boolean} True if should be marked as stalled
   * @private
   */
  _shouldMarkAsStalled(telemetry, diff, type, now) {
    const isDownload = type === 'download';
    const activityKey = isDownload ? 'last_download_activity_at' : 'last_upload_activity_at';
    const stalledKey = isDownload ? 'stalled_since' : 'upload_stalled_since';
    const diffKey = isDownload ? 'downloadChanged' : 'uploadChanged';
    const deltaKey = isDownload ? 'downloadDelta' : 'uploadDelta';

    // Already stalled
    if (telemetry[stalledKey]) {
      return false;
    }

    // No change detected or change detected with activity
    if (!diff[diffKey] || diff[deltaKey] > 0) {
      return false;
    }

    // Check inactivity duration
    const lastActivity = telemetry[activityKey]
      ? new Date(telemetry[activityKey])
      : new Date(telemetry.created_at);
    const inactiveTimeSeconds = (now - lastActivity) / 1000;

    return inactiveTimeSeconds > STALL_THRESHOLD_SECONDS;
  }

  /**
   * Apply telemetry updates to database with validation
   * @param {string} torrentId - Torrent ID
   * @param {Object} updates - Updates object
   * @private
   */
  _applyTelemetryUpdates(torrentId, updates) {
    // Filter and validate column names for security
    const validUpdates = Object.keys(updates)
      .filter((key) => ALLOWED_TELEMETRY_COLUMNS.includes(key))
      .reduce((acc, key) => {
        acc[key] = updates[key];
        return acc;
      }, {});

    if (Object.keys(validUpdates).length === 0) {
      return;
    }

    const setClause = Object.keys(validUpdates)
      .map((key) => `${key} = ?`)
      .join(', ');
    const values = Object.keys(validUpdates).map((key) => validUpdates[key]);
    values.push(torrentId);

    this.db
      .prepare(
        `
      UPDATE torrent_telemetry 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE torrent_id = ?
    `
      )
      .run(...values);
  }

  /**
   * Handle state transitions
   * @param {Object} transition - State transition object
   * @param {Date} now - Current timestamp
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

    // Clear stalled when transitioning to non-stalled state
    if (NOT_STALLED_STATES.includes(to)) {
      const telemetry = this.stmts.getStalledSince.get(torrent_id);
      if (telemetry?.stalled_since) {
        updates.stalled_since = null;
        updates.last_stall_resumed_at = nowISO;
      }
    }

    if (Object.keys(updates).length > 0) {
      this._applyTelemetryUpdates(torrent_id, updates);
    }
  }

  /**
   * Get torrent state from API response
   * @param {Object} torrent - Torrent object from API
   * @returns {string} Torrent state
   */
  getTorrentState(torrent) {
    return getTorrentStatus(torrent);
  }

  /**
   * Get telemetry for a torrent
   * @param {string} torrentId - Torrent ID
   * @returns {Object|null} Telemetry record or null if not found
   */
  getTelemetry(torrentId) {
    return this.stmts.getTelemetry.get(torrentId) || null;
  }
}

export default DerivedFieldsEngine;
