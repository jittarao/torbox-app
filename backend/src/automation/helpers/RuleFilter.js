import logger from '../../utils/logger.js';
import { getTorrentStatus } from '../../utils/torrentStatus.js';

/**
 * Helper for filtering torrents based on rule actions
 */
class RuleFilter {
  constructor(authId, getUserDb) {
    this.authId = authId;
    this.getUserDb = getUserDb;
  }

  /**
   * Filter torrents for add_tag action - skip torrents that already have all the tags
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForAddTag(matchingTorrents, action) {
    if (action.type !== 'add_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingTorrents;
    }

    const userDb = await this.getUserDb();

    // Collect all download IDs
    const allDownloadIds = matchingTorrents
      .map(
        (t) =>
          t.id?.toString() ||
          t.torrent_id?.toString() ||
          t.usenet_id?.toString() ||
          t.web_id?.toString()
      )
      .filter((id) => id);

    if (allDownloadIds.length === 0) {
      return matchingTorrents;
    }

    // Batch load tags for all matching torrents
    const placeholders = allDownloadIds.map(() => '?').join(',');
    const allDownloadTags = userDb
      .prepare(
        `
      SELECT dt.download_id, dt.tag_id
      FROM download_tags dt
      WHERE dt.download_id IN (${placeholders})
    `
      )
      .all(...allDownloadIds);

    // Group tag IDs by download_id
    const tagsByDownloadId = new Map();
    for (const row of allDownloadTags) {
      const downloadId = String(row.download_id);
      if (!tagsByDownloadId.has(downloadId)) {
        tagsByDownloadId.set(downloadId, new Set());
      }
      tagsByDownloadId.get(downloadId).add(row.tag_id);
    }

    // Filter out torrents that already have all the tags
    const targetTagIds = new Set(action.tagIds);
    const filtered = matchingTorrents.filter((torrent) => {
      const downloadId =
        torrent.id?.toString() ||
        torrent.torrent_id?.toString() ||
        torrent.usenet_id?.toString() ||
        torrent.web_id?.toString();
      if (!downloadId) {
        return true; // Keep torrents without ID (will fail later, but let it fail explicitly)
      }

      const existingTagIds = tagsByDownloadId.get(downloadId) || new Set();

      // Check if torrent already has all the tags
      const hasAllTags = Array.from(targetTagIds).every((tagId) => existingTagIds.has(tagId));

      if (hasAllTags) {
        logger.debug('Skipping torrent - already has all tags', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
          existingTagIds: Array.from(existingTagIds),
          targetTagIds: Array.from(targetTagIds),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered torrents that already have all tags', {
        authId: this.authId,
        originalCount: matchingTorrents.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter torrents for remove_tag action - skip torrents that don't have any of the tags
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForRemoveTag(matchingTorrents, action) {
    if (action.type !== 'remove_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingTorrents;
    }

    const userDb = await this.getUserDb();

    // Collect all download IDs
    const allDownloadIds = matchingTorrents
      .map(
        (t) =>
          t.id?.toString() ||
          t.torrent_id?.toString() ||
          t.usenet_id?.toString() ||
          t.web_id?.toString()
      )
      .filter((id) => id);

    if (allDownloadIds.length === 0) {
      return matchingTorrents;
    }

    // Batch load tags for all matching torrents
    const placeholders = allDownloadIds.map(() => '?').join(',');
    const allDownloadTags = userDb
      .prepare(
        `
      SELECT dt.download_id, dt.tag_id
      FROM download_tags dt
      WHERE dt.download_id IN (${placeholders})
    `
      )
      .all(...allDownloadIds);

    // Group tag IDs by download_id
    const tagsByDownloadId = new Map();
    for (const row of allDownloadTags) {
      const downloadId = String(row.download_id);
      if (!tagsByDownloadId.has(downloadId)) {
        tagsByDownloadId.set(downloadId, new Set());
      }
      tagsByDownloadId.get(downloadId).add(row.tag_id);
    }

    // Filter out torrents that don't have any of the tags to remove
    const targetTagIds = new Set(action.tagIds);
    const filtered = matchingTorrents.filter((torrent) => {
      const downloadId =
        torrent.id?.toString() ||
        torrent.torrent_id?.toString() ||
        torrent.usenet_id?.toString() ||
        torrent.web_id?.toString();
      if (!downloadId) {
        return true; // Keep torrents without ID (will fail later, but let it fail explicitly)
      }

      const existingTagIds = tagsByDownloadId.get(downloadId) || new Set();

      // Check if torrent has at least one of the tags to remove
      const hasAnyTag = Array.from(targetTagIds).some((tagId) => existingTagIds.has(tagId));

      if (!hasAnyTag) {
        logger.debug('Skipping torrent - does not have any tags to remove', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
          existingTagIds: Array.from(existingTagIds),
          targetTagIds: Array.from(targetTagIds),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered torrents that do not have tags to remove', {
        authId: this.authId,
        originalCount: matchingTorrents.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter torrents for stop_seeding action - skip torrents that are not currently seeding
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForStopSeeding(matchingTorrents, action) {
    if (action.type !== 'stop_seeding') {
      return matchingTorrents;
    }

    const filtered = matchingTorrents.filter((torrent) => {
      const status = getTorrentStatus(torrent);
      const isSeeding = status === 'seeding';

      if (!isSeeding) {
        logger.debug('Skipping torrent - not currently seeding', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
          status,
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered torrents that are not seeding', {
        authId: this.authId,
        originalCount: matchingTorrents.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter torrents for force_start action - skip torrents that are already queued
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForForceStart(matchingTorrents, action) {
    if (action.type !== 'force_start') {
      return matchingTorrents;
    }

    const filtered = matchingTorrents.filter((torrent) => {
      const status = getTorrentStatus(torrent);
      const isQueued = status === 'queued';

      if (isQueued) {
        logger.debug('Skipping torrent - already queued', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
          status,
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered torrents that are already queued', {
        authId: this.authId,
        originalCount: matchingTorrents.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter torrents based on action type
   * Routes to the appropriate filter method based on action type
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterTorrents(matchingTorrents, action) {
    if (!action || !action.type) {
      return matchingTorrents;
    }

    switch (action.type) {
      case 'add_tag':
        return await this.filterForAddTag(matchingTorrents, action);
      case 'remove_tag':
        return await this.filterForRemoveTag(matchingTorrents, action);
      case 'stop_seeding':
        return await this.filterForStopSeeding(matchingTorrents, action);
      case 'force_start':
        return await this.filterForForceStart(matchingTorrents, action);
      case 'archive':
      case 'delete':
        // Archive and delete actions don't need filtering
        // Archived downloads are removed from main list
        // Delete action removes downloads completely
        return matchingTorrents;
      default:
        // Unknown action type, don't filter
        logger.warn('Unknown action type, skipping filter', {
          authId: this.authId,
          actionType: action.type,
        });
        return matchingTorrents;
    }
  }
}

export default RuleFilter;
