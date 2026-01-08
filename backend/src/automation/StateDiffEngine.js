import { getTorrentStatus } from '../utils/torrentStatus.js';

/**
 * State Diff Engine
 * Compares API snapshots with shadow state to detect changes
 */
class StateDiffEngine {
  constructor(userDb) {
    this.db = userDb;
  }

  /**
   * Process a snapshot of torrents from the API
   * @param {Array} torrents - Current torrents from API
   * @returns {Promise<Object>} - Diff results with changes detected
   */
  async processSnapshot(torrents) {
    const now = new Date();
    const changes = {
      new: [],
      updated: [],
      removed: [],
      stateTransitions: []
    };

    // Get current shadow state
    const shadowState = this.db.prepare(`
      SELECT * FROM torrent_shadow
    `).all();

    const shadowMap = new Map(shadowState.map(s => [s.torrent_id, s]));
    const currentIds = new Set(torrents.map(t => t.id));

    // Process each torrent from API
    for (const torrent of torrents) {
      const state = this.getTorrentState(torrent);
      
      // Skip terminal states - don't store them in shadow
      if (this.isTerminalState(state)) {
        // If it was in shadow, mark as removed (transition to terminal state)
        const shadow = shadowMap.get(torrent.id);
        if (shadow) {
          changes.removed.push(shadow);
          // Remove from shadow since it's now terminal
          this.db.prepare('DELETE FROM torrent_shadow WHERE torrent_id = ?').run(torrent.id);
        }
        continue;
      }

      const shadow = shadowMap.get(torrent.id);
      
      if (!shadow) {
        // New torrent
        changes.new.push(torrent);
        await this.insertShadowState(torrent, now);
      } else {
        // Check for changes
        const diff = this.computeDiff(shadow, torrent);
        if (diff.hasChanges) {
          changes.updated.push({ torrent, diff, shadow });
          
          // Check for state transitions
          if (diff.stateChanged) {
            changes.stateTransitions.push({
              torrent_id: torrent.id,
              from: shadow.last_state,
              to: state,
              timestamp: now
            });
          }
          
          await this.updateShadowState(torrent, now);
        }
      }
    }

    // Find removed torrents (in shadow but not in API)
    for (const [torrentId, shadow] of shadowMap) {
      if (!currentIds.has(torrentId)) {
        changes.removed.push(shadow);
      }
    }

    return changes;
  }

  /**
   * Compute diff between shadow state and current torrent
   */
  computeDiff(shadow, torrent) {
    const state = this.getTorrentState(torrent);
    const totalDownloaded = torrent.total_downloaded || 0;
    const totalUploaded = torrent.total_uploaded || 0;

    return {
      hasChanges: 
        shadow.last_total_downloaded !== totalDownloaded ||
        shadow.last_total_uploaded !== totalUploaded ||
        shadow.last_state !== state,
      stateChanged: shadow.last_state !== state,
      downloadChanged: shadow.last_total_downloaded !== totalDownloaded,
      uploadChanged: shadow.last_total_uploaded !== totalUploaded,
      downloadDelta: totalDownloaded - shadow.last_total_downloaded,
      uploadDelta: totalUploaded - shadow.last_total_uploaded
    };
  }

  /**
   * Get torrent state from API response
   * Filters out terminal states that don't need to be tracked
   */
  getTorrentState(torrent) {
    const state = getTorrentStatus(torrent);
    // Terminal states: 'completed' and 'failed' are not stored in shadow
    // as torrents in these states are typically removed from the API
    return state;
  }

  /**
   * Check if a state is terminal (should not be stored in shadow)
   * @param {string} state - Torrent state
   * @returns {boolean} - True if state is terminal
   */
  isTerminalState(state) {
    return state === 'completed' || state === 'failed' || state === 'inactive';
  }

  /**
   * Insert new shadow state (or replace if exists)
   */
  async insertShadowState(torrent, timestamp) {
    const state = this.getTorrentState(torrent);
    
    // Don't store terminal states
    if (this.isTerminalState(state)) {
      return;
    }
    
    this.db.prepare(`
      INSERT OR REPLACE INTO torrent_shadow (
        torrent_id,
        last_total_downloaded, last_total_uploaded, last_state,
        updated_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      torrent.id,
      torrent.total_downloaded || 0,
      torrent.total_uploaded || 0,
      state
    );
  }

  /**
   * Update existing shadow state
   */
  async updateShadowState(torrent, timestamp) {
    const state = this.getTorrentState(torrent);
    
    // If state became terminal, remove from shadow
    if (this.isTerminalState(state)) {
      this.db.prepare('DELETE FROM torrent_shadow WHERE torrent_id = ?').run(torrent.id);
      return;
    }
    
    this.db.prepare(`
      UPDATE torrent_shadow SET
        last_total_downloaded = ?,
        last_total_uploaded = ?,
        last_state = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE torrent_id = ?
    `).run(
      torrent.total_downloaded || 0,
      torrent.total_uploaded || 0,
      state,
      torrent.id
    );
  }

  /**
   * Get shadow state for a torrent
   */
  getShadowState(torrentId) {
    return this.db.prepare(`
      SELECT * FROM torrent_shadow WHERE torrent_id = ?
    `).get(torrentId);
  }
}

export default StateDiffEngine;

