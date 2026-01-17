import { getTorrentStatus } from '../utils/torrentStatus.js';

/**
 * Constants for derived fields engine
 */
const STALL_THRESHOLD_SECONDS = 300; // 5 minutes

/**
 * Format date to SQL datetime string (YYYY-MM-DD HH:MM:SS)
 * SQLite DATETIME columns expect this format, not ISO 8601
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} Formatted date string in SQL datetime format
 */
function formatDateForSQL(date) {
  if (!date) return null;
  
  // If already in SQL datetime format (YYYY-MM-DD HH:MM:SS), return as is
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date)) {
    return date;
  }
  
  // Convert Date object or ISO string to SQL datetime format
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return null;
  }
  
  // Convert ISO format (2026-01-17T00:14:03.471Z) to SQL format (2026-01-17 00:14:03)
  return dateObj.toISOString().replace('T', ' ').substring(0, 19);
}
const ALLOWED_TELEMETRY_COLUMNS = [
  'last_download_activity_at',
  'stalled_since',
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
      getShadowState: this.db.prepare(`
        SELECT created_at, last_total_downloaded, last_total_uploaded FROM torrent_shadow WHERE torrent_id = ?
      `),
      getAllTelemetryWithShadow: this.db.prepare(`
        SELECT 
          t.torrent_id,
          t.last_download_activity_at,
          t.last_upload_activity_at,
          t.stalled_since,
          t.upload_stalled_since,
          t.created_at as telemetry_created_at,
          s.created_at as shadow_created_at,
          s.last_total_downloaded,
          s.last_total_uploaded,
          s.last_state
        FROM torrent_telemetry t
        LEFT JOIN torrent_shadow s ON t.torrent_id = s.torrent_id
        WHERE (
          -- Include if activity timestamps are NULL and torrent has activity history
          ((t.last_download_activity_at IS NULL OR t.last_upload_activity_at IS NULL)
           AND (s.last_total_downloaded > 0 OR s.last_total_uploaded > 0))
          -- Include if stalled_since is NULL and state is stalled (regardless of bytes)
          OR (t.stalled_since IS NULL AND s.last_state = 'stalled')
          -- Include if upload_stalled_since is NULL and state is seeding (regardless of bytes)
          OR (t.upload_stalled_since IS NULL AND s.last_state = 'seeding')
        )
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

    // Process removed torrents
    // Note: Shadow state is already deleted in StateDiffEngine._findRemovedTorrents(),
    // which cascades to telemetry and speed_history via foreign key constraints (ON DELETE CASCADE)
    for (const shadow of changes.removed) {
      // No-op: cleanup is handled by StateDiffEngine via CASCADE delete
    }

    // Process state transitions
    for (const transition of changes.stateTransitions) {
      await this.handleStateTransition(transition, now);
    }

    // Backfill all telemetry records with NULL activity timestamps
    // This handles cases where telemetry exists but wasn't updated in this poll cycle
    await this._backfillAllTelemetryRecords(now);
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
    const now = new Date();
    const nowSQL = formatDateForSQL(now);
    const totalDownloaded = torrent.total_downloaded || 0;
    const totalUploaded = torrent.total_uploaded || 0;

    // Get shadow state to use created_at as fallback for activity timestamps
    const shadow = this.stmts.getShadowState.get(torrentId);
    // Explicitly check for null/undefined - shadow.created_at might be NULL in DB
    // shadow.created_at is already in SQL datetime format from database
    const activityTimestamp = shadow && shadow.created_at != null ? shadow.created_at : nowSQL;

    // Initialize based on current state
    if (state === 'downloading') {
      this.stmts.insertTelemetry.run(torrentId, nowSQL, null);
    } else if (state === 'seeding') {
      this.stmts.insertTelemetry.run(torrentId, null, nowSQL);
    } else {
      // For other states (including stalled), check if torrent has activity history
      // If it has downloaded/uploaded bytes, set activity timestamps
      const lastDownloadActivity = totalDownloaded > 0 ? activityTimestamp : null;
      const lastUploadActivity = totalUploaded > 0 ? activityTimestamp : null;

      if (lastDownloadActivity || lastUploadActivity) {
        this.stmts.insertTelemetry.run(torrentId, lastDownloadActivity, lastUploadActivity);
      } else {
        this.stmts.insertTelemetryMinimal.run(torrentId);
      }
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

    // Backfill activity timestamps if they're NULL but torrent has activity history
    const backfillUpdates = this._backfillActivityTimestamps(telemetry, torrent, state, now);
    if (Object.keys(backfillUpdates).length > 0) {
      this._applyTelemetryUpdates(torrentId, backfillUpdates);
      // Refresh telemetry after backfill
      telemetry = this.stmts.getTelemetry.get(torrentId);
    }

    const updates = this._computeTelemetryUpdates(telemetry, torrent, diff, state, now);

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      this._applyTelemetryUpdates(torrentId, updates);
    }
  }

  /**
   * Backfill activity timestamps for telemetry records with NULL values
   * when torrent has activity history (bytes downloaded/uploaded)
   * @param {Object} telemetry - Current telemetry record
   * @param {Object} torrent - Current torrent state
   * @param {string} state - Current torrent state
   * @param {Date} now - Current timestamp
   * @returns {Object} Updates object
   * @private
   */
  _backfillActivityTimestamps(telemetry, torrent, state, now) {
    const updates = {};
    const totalDownloaded = torrent.total_downloaded || 0;
    const totalUploaded = torrent.total_uploaded || 0;

    // Get shadow state to use created_at as fallback for activity timestamps
    const shadow = this.stmts.getShadowState.get(torrent.id);

    // Explicitly check for null/undefined - shadow.created_at might be NULL in DB
    // Database timestamps are in SQL datetime format, so use them directly
    let activityTimestamp = formatDateForSQL(now); // Default to current time
    if (shadow && shadow.created_at != null) {
      activityTimestamp = shadow.created_at; // Already in SQL format
    } else if (telemetry && telemetry.created_at != null) {
      activityTimestamp = telemetry.created_at; // Already in SQL format
    }

    // If torrent is already in stalled state and we're backfilling, set activity timestamp
    // to at least STALL_THRESHOLD_SECONDS ago so it will be correctly detected as stalled
    if (state === 'stalled') {
      // Parse SQL datetime format to Date for comparison
      const activityDate = new Date(activityTimestamp.replace(' ', 'T') + 'Z');
      const minStallTime = new Date(now.getTime() - (STALL_THRESHOLD_SECONDS + 60) * 1000); // Add 1 minute buffer
      if (activityDate > minStallTime) {
        activityTimestamp = formatDateForSQL(minStallTime);
      }
    }

    // Backfill download activity if NULL but torrent has downloaded bytes
    if (!telemetry.last_download_activity_at && totalDownloaded > 0) {
      updates.last_download_activity_at = activityTimestamp;
    }

    // Backfill upload activity if NULL but torrent has uploaded bytes
    if (!telemetry.last_upload_activity_at && totalUploaded > 0) {
      updates.last_upload_activity_at = activityTimestamp;
    }

    return updates;
  }

  /**
   * Backfill all telemetry records that have NULL activity timestamps
   * Uses shadow state data to determine if torrent has activity history
   * @param {Date} now - Current timestamp
   * @private
   */
  async _backfillAllTelemetryRecords(now) {
    try {
      const records = this.stmts.getAllTelemetryWithShadow.all();

      for (const record of records) {
        const updates = {};
        const totalDownloaded = record.last_total_downloaded || 0;
        const totalUploaded = record.last_total_uploaded || 0;
        const state = record.last_state;

        // Determine activity timestamp - prefer shadow.created_at, fallback to telemetry.created_at, then now
        // Database timestamps are in SQL datetime format, so use them directly
        let activityTimestamp = formatDateForSQL(now);
        if (record.shadow_created_at != null) {
          activityTimestamp = record.shadow_created_at; // Already in SQL format
        } else if (record.telemetry_created_at != null) {
          activityTimestamp = record.telemetry_created_at; // Already in SQL format
        }

        // If torrent is already in stalled state and we're backfilling, set activity timestamp
        // to at least STALL_THRESHOLD_SECONDS ago so it will be correctly detected as stalled
        if (state === 'stalled') {
          // Parse SQL datetime format to Date for comparison
          const activityDate = new Date(activityTimestamp.replace(' ', 'T') + 'Z');
          const minStallTime = new Date(now.getTime() - (STALL_THRESHOLD_SECONDS + 60) * 1000); // Add 1 minute buffer
          if (activityDate > minStallTime) {
            activityTimestamp = formatDateForSQL(minStallTime);
          }
        }

        // Check if download activity needs backfilling
        if (!record.last_download_activity_at && totalDownloaded > 0) {
          updates.last_download_activity_at = activityTimestamp;
        }

        // Check if upload activity needs backfilling
        if (!record.last_upload_activity_at && totalUploaded > 0) {
          updates.last_upload_activity_at = activityTimestamp;
        }

        // After backfilling activity timestamps, check if we need to set stalled_since or upload_stalled_since
        // Use the activity timestamp we just set, or the existing one
        const finalDownloadActivity =
          updates.last_download_activity_at || record.last_download_activity_at;
        const finalUploadActivity =
          updates.last_upload_activity_at || record.last_upload_activity_at;

        // Handle download stall: if state is 'stalled' and no stalled_since is set
        if (state === 'stalled' && !record.stalled_since) {
          if (finalDownloadActivity) {
            // Torrent has download activity history, use it
            updates.stalled_since = finalDownloadActivity;
          } else if (totalDownloaded === 0) {
            // Torrent has never downloaded anything (0 bytes), use creation time as stalled_since
            // This handles torrents that have been stalled since creation (0% progress)
            // Only set if totalDownloaded is 0 to avoid incorrect timestamps for torrents with progress
            updates.stalled_since = activityTimestamp;
          }
          // If torrent has progress (totalDownloaded > 0) but no last_download_activity_at,
          // don't set stalled_since - this could indicate data inconsistency
        }

        // Handle upload stall: if state is 'seeding' and we have upload activity but no upload_stalled_since
        // and inactivity exceeds threshold
        if (state === 'seeding' && !record.upload_stalled_since && finalUploadActivity) {
          // Database timestamps are in SQL datetime format, parse them correctly
          const lastActivity = new Date(finalUploadActivity.replace(' ', 'T') + 'Z');
          const inactiveTimeSeconds = (now - lastActivity) / 1000;
          if (inactiveTimeSeconds > STALL_THRESHOLD_SECONDS) {
            updates.upload_stalled_since = finalUploadActivity;
          }
        }

        // Apply updates if any
        if (Object.keys(updates).length > 0) {
          this._applyTelemetryUpdates(record.torrent_id, updates);
        }
      }
    } catch (error) {
      // Log error but don't throw - backfilling is not critical
      // logger.error('Error backfilling telemetry records', error);
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
    const nowSQL = formatDateForSQL(now);

    // Handle download activity
    if (diff.downloadChanged && diff.downloadDelta > 0) {
      updates.last_download_activity_at = nowSQL;
      this._clearStallIfActive(telemetry, updates, nowSQL);
    }

    // Handle upload activity
    if (diff.uploadChanged && diff.uploadDelta > 0) {
      updates.last_upload_activity_at = nowSQL;
      if (telemetry.upload_stalled_since) {
        updates.upload_stalled_since = null;
      }
    }

    // Check for download stall condition
    if (state === 'downloading' && this._shouldMarkAsStalled(telemetry, diff, 'download', now)) {
      // Set stalled_since to when the stall actually started (when activity stopped)
      // Database timestamps are in SQL datetime format, parse them correctly
      const lastActivity = telemetry.last_download_activity_at
        ? new Date(telemetry.last_download_activity_at.replace(' ', 'T') + 'Z')
        : new Date(telemetry.created_at.replace(' ', 'T') + 'Z');
      updates.stalled_since = formatDateForSQL(lastActivity);
    }

    // Handle torrents that are already in stalled state from API
    // If stalled_since is not set, set it based on download activity history or creation time
    if (state === 'stalled' && !telemetry.stalled_since) {
      if (telemetry.last_download_activity_at) {
        // Torrent is already stalled, set stalled_since to when activity stopped
        updates.stalled_since = telemetry.last_download_activity_at;
      } else {
        // Check if torrent has actually made any progress
        // Only use creation time if torrent has 0 bytes downloaded
        const totalDownloaded = torrent.total_downloaded || 0;
        const hasNoDownloaded = totalDownloaded === 0;

        if (hasNoDownloaded) {
          // Torrent has never downloaded anything, use creation time as stalled_since
          // This handles torrents that have been stalled since creation (0% progress)
          const stalledSince = torrent.created_at
            ? formatDateForSQL(new Date(torrent.created_at))
            : telemetry.created_at || nowSQL;
          updates.stalled_since = stalledSince;
        }
        // If torrent has downloaded bytes but no last_download_activity_at, don't set stalled_since
        // This could indicate data inconsistency - let it be handled by normal stall detection
      }
    }

    // Check for upload stall condition
    if (state === 'seeding' && this._shouldMarkAsStalled(telemetry, diff, 'upload', now)) {
      // Set upload_stalled_since to when the stall actually started (when activity stopped)
      // Database timestamps are in SQL datetime format, parse them correctly
      const lastActivity = telemetry.last_upload_activity_at
        ? new Date(telemetry.last_upload_activity_at.replace(' ', 'T') + 'Z')
        : new Date(telemetry.created_at.replace(' ', 'T') + 'Z');
      updates.upload_stalled_since = formatDateForSQL(lastActivity);
    }

    // Handle seeding torrents that may already be upload-stalled
    // If upload_stalled_since is not set but we have upload activity history and inactivity > threshold, set it
    if (
      state === 'seeding' &&
      !telemetry.upload_stalled_since &&
      telemetry.last_upload_activity_at
    ) {
      // Database timestamps are in SQL datetime format, parse them correctly
      const lastActivity = new Date(telemetry.last_upload_activity_at.replace(' ', 'T') + 'Z');
      const inactiveTimeSeconds = (now - lastActivity) / 1000;
      if (inactiveTimeSeconds > STALL_THRESHOLD_SECONDS) {
        // Torrent is seeding but upload has been inactive, set upload_stalled_since to when activity stopped
        // Use the value as-is since it's already in SQL format
        updates.upload_stalled_since = telemetry.last_upload_activity_at;
      }
    }

    return updates;
  }

  /**
   * Clear stall markers if activity detected
   * @param {Object} telemetry - Current telemetry record
   * @param {Object} updates - Updates object to modify
   * @param {string} nowSQL - Current timestamp as SQL datetime string
   * @private
   */
  _clearStallIfActive(telemetry, updates, nowSQL) {
    if (telemetry.stalled_since) {
      updates.stalled_since = null;
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
    // Database timestamps are in SQL datetime format, parse them correctly
    const lastActivity = telemetry[activityKey]
      ? new Date(telemetry[activityKey].replace(' ', 'T') + 'Z')
      : new Date(telemetry.created_at.replace(' ', 'T') + 'Z');
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
    // Also filter out undefined values (but keep null if explicitly set)
    const validUpdates = Object.keys(updates)
      .filter((key) => ALLOWED_TELEMETRY_COLUMNS.includes(key) && updates[key] !== undefined)
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
      SET ${setClause}, updated_at = MAX(created_at, CURRENT_TIMESTAMP)
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
    const nowSQL = formatDateForSQL(now);
    const updates = {};

    // Detect download start
    if (from !== 'downloading' && to === 'downloading') {
      updates.last_download_activity_at = nowSQL;
    }

    // Detect seeding start
    if (from !== 'seeding' && to === 'seeding') {
      updates.last_upload_activity_at = nowSQL;
    }

    // Clear stalled when transitioning to non-stalled state
    if (NOT_STALLED_STATES.includes(to)) {
      const telemetry = this.stmts.getStalledSince.get(torrent_id);
      if (telemetry?.stalled_since) {
        updates.stalled_since = null;
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
