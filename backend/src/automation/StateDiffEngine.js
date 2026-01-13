import { getTorrentStatus } from '../utils/torrentStatus.js';
import logger from '../utils/logger.js';
import { TERMINAL_STATES } from './helpers/constants.js';

/**
 * State Diff Engine
 * Compares API snapshots with shadow state to detect changes in torrent status,
 * download/upload progress, and state transitions.
 */
class StateDiffEngine {
  constructor(userDb) {
    this.db = userDb;
    this._prepareStatements();
  }

  /**
   * Prepare SQL statements for better performance and reusability
   * @private
   */
  _prepareStatements() {
    this._stmtGetAllShadow = this.db.prepare('SELECT * FROM torrent_shadow');
    this._stmtGetShadow = this.db.prepare('SELECT * FROM torrent_shadow WHERE torrent_id = ?');
    this._stmtDeleteShadow = this.db.prepare('DELETE FROM torrent_shadow WHERE torrent_id = ?');
    this._stmtInsertShadow = this.db.prepare(`
      INSERT OR REPLACE INTO torrent_shadow (
        torrent_id,
        last_total_downloaded,
        last_total_uploaded,
        last_state,
        updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    this._stmtUpdateShadow = this.db.prepare(`
      UPDATE torrent_shadow SET
        last_total_downloaded = ?,
        last_total_uploaded = ?,
        last_state = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE torrent_id = ?
    `);
  }

  /**
   * Process a snapshot of torrents from the API and detect changes
   * @param {Array<Object>} torrents - Current torrents from API
   * @returns {Promise<Object>} Diff results with changes detected:
   *   - new: Array of new torrents
   *   - updated: Array of updated torrents with diff information
   *   - removed: Array of removed torrents (from shadow state)
   *   - stateTransitions: Array of state transition records
   */
  async processSnapshot(torrents) {
    const now = new Date();
    const changes = {
      new: [],
      updated: [],
      removed: [],
      stateTransitions: [],
    };

    const shadowState = this._getAllShadowState();
    const shadowMap = new Map(shadowState.map((s) => [s.torrent_id, s]));
    const currentIds = new Set(torrents.map((t) => t.id));

    // Process each torrent from API
    for (const torrent of torrents) {
      const state = this.getTorrentState(torrent);

      if (this.isTerminalState(state)) {
        this._handleTerminalState(torrent, shadowMap, changes);
        continue;
      }

      const shadow = shadowMap.get(torrent.id);

      if (!shadow) {
        this._handleNewTorrent(torrent, changes, now);
      } else {
        this._handleExistingTorrent(torrent, shadow, state, changes, now);
      }
    }

    // Find removed torrents (in shadow but not in API)
    this._findRemovedTorrents(shadowMap, currentIds, changes);

    return changes;
  }

  /**
   * Handle torrent in terminal state
   * @private
   * @param {Object} torrent - Torrent object
   * @param {Map} shadowMap - Map of shadow states
   * @param {Object} changes - Changes object to update
   */
  _handleTerminalState(torrent, shadowMap, changes) {
    const shadow = shadowMap.get(torrent.id);
    if (shadow) {
      changes.removed.push(shadow);
      this._deleteShadowState(torrent.id);
    }
  }

  /**
   * Handle new torrent (not in shadow state)
   * @private
   * @param {Object} torrent - Torrent object
   * @param {Object} changes - Changes object to update
   * @param {Date} timestamp - Current timestamp
   */
  _handleNewTorrent(torrent, changes, timestamp) {
    changes.new.push(torrent);
    this.insertShadowState(torrent, timestamp);
  }

  /**
   * Handle existing torrent (in shadow state)
   * @private
   * @param {Object} torrent - Torrent object
   * @param {Object} shadow - Shadow state record
   * @param {string} state - Current torrent state
   * @param {Object} changes - Changes object to update
   * @param {Date} timestamp - Current timestamp
   */
  _handleExistingTorrent(torrent, shadow, state, changes, timestamp) {
    const diff = this.computeDiff(shadow, torrent);

    if (diff.hasChanges) {
      changes.updated.push({ torrent, diff, shadow });

      if (diff.stateChanged) {
        changes.stateTransitions.push({
          torrent_id: torrent.id,
          from: shadow.last_state,
          to: state,
          timestamp,
        });
      }

      this.updateShadowState(torrent, timestamp);
    }
  }

  /**
   * Find torrents that were removed (in shadow but not in current API response)
   * @private
   * @param {Map} shadowMap - Map of shadow states
   * @param {Set} currentIds - Set of current torrent IDs
   * @param {Object} changes - Changes object to update
   */
  _findRemovedTorrents(shadowMap, currentIds, changes) {
    for (const [torrentId, shadow] of shadowMap) {
      if (!currentIds.has(torrentId)) {
        changes.removed.push(shadow);
      }
    }
  }

  /**
   * Compute diff between shadow state and current torrent
   * @param {Object} shadow - Shadow state record
   * @param {Object} torrent - Current torrent from API
   * @returns {Object} Diff object with:
   *   - hasChanges: Boolean indicating if any changes detected
   *   - stateChanged: Boolean indicating if state changed
   *   - downloadChanged: Boolean indicating if download changed
   *   - uploadChanged: Boolean indicating if upload changed
   *   - downloadDelta: Numeric delta for download
   *   - uploadDelta: Numeric delta for upload
   */
  computeDiff(shadow, torrent) {
    const state = this.getTorrentState(torrent);
    const totalDownloaded = torrent.total_downloaded || 0;
    const totalUploaded = torrent.total_uploaded || 0;

    const downloadChanged = shadow.last_total_downloaded !== totalDownloaded;
    const uploadChanged = shadow.last_total_uploaded !== totalUploaded;
    const stateChanged = shadow.last_state !== state;

    return {
      hasChanges: downloadChanged || uploadChanged || stateChanged,
      stateChanged,
      downloadChanged,
      uploadChanged,
      downloadDelta: totalDownloaded - shadow.last_total_downloaded,
      uploadDelta: totalUploaded - shadow.last_total_uploaded,
    };
  }

  /**
   * Get torrent state from API response
   * @param {Object} torrent - Torrent object from API
   * @returns {string} Torrent state string
   */
  getTorrentState(torrent) {
    return getTorrentStatus(torrent);
  }

  /**
   * Check if a state is terminal (should not be stored in shadow)
   * Terminal states are those where the torrent doesn't need tracking:
   * - 'completed': Download finished, no longer active
   * - 'failed': Download failed, no longer active
   * - 'inactive': Not active and download not present - no telemetry or diff data needed
   *
   * Note: Terminal states are still evaluated by automation rules since rules
   * operate on live API data, not shadow state. Terminal states just don't need
   * to be tracked in torrent_shadow or torrent_telemetry.
   * @param {string} state - Torrent state
   * @returns {boolean} True if state is terminal
   */
  isTerminalState(state) {
    return TERMINAL_STATES.includes(state);
  }

  /**
   * Insert new shadow state (or replace if exists)
   * @param {Object} torrent - Torrent object
   * @param {Date} timestamp - Timestamp (currently unused, kept for API compatibility)
   */
  insertShadowState(torrent, timestamp) {
    const state = this.getTorrentState(torrent);

    // Don't store terminal states
    if (this.isTerminalState(state)) {
      return;
    }

    try {
      this._stmtInsertShadow.run(
        torrent.id,
        torrent.total_downloaded || 0,
        torrent.total_uploaded || 0,
        state
      );
    } catch (error) {
      logger.error('Failed to insert shadow state', error, {
        torrentId: torrent.id,
      });
      throw error;
    }
  }

  /**
   * Update existing shadow state
   * @param {Object} torrent - Torrent object
   * @param {Date} timestamp - Timestamp (currently unused, kept for API compatibility)
   */
  updateShadowState(torrent, timestamp) {
    const state = this.getTorrentState(torrent);

    // If state became terminal, remove from shadow
    if (this.isTerminalState(state)) {
      this._deleteShadowState(torrent.id);
      return;
    }

    try {
      this._stmtUpdateShadow.run(
        torrent.total_downloaded || 0,
        torrent.total_uploaded || 0,
        state,
        torrent.id
      );
    } catch (error) {
      logger.error('Failed to update shadow state', error, {
        torrentId: torrent.id,
      });
      throw error;
    }
  }

  /**
   * Get shadow state for a specific torrent
   * @param {string|number} torrentId - Torrent ID
   * @returns {Object|undefined} Shadow state record or undefined if not found
   */
  getShadowState(torrentId) {
    try {
      return this._stmtGetShadow.get(torrentId);
    } catch (error) {
      logger.error('Failed to get shadow state', error, { torrentId });
      throw error;
    }
  }

  /**
   * Get all shadow state records
   * @private
   * @returns {Array} Array of shadow state records
   */
  _getAllShadowState() {
    try {
      return this._stmtGetAllShadow.all();
    } catch (error) {
      logger.error('Failed to retrieve shadow state', error);
      throw error;
    }
  }

  /**
   * Delete shadow state for a torrent
   * @private
   * @param {string|number} torrentId - Torrent ID
   */
  _deleteShadowState(torrentId) {
    try {
      this._stmtDeleteShadow.run(torrentId);
    } catch (error) {
      logger.error('Failed to delete terminal state from shadow', error, {
        torrentId,
      });
      throw error;
    }
  }
}

export default StateDiffEngine;
