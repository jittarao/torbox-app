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
   * Build a map of download ID -> tag IDs from the database for the given torrents.
   * @param {Array} matchingTorrents - Torrents to look up tags for
   * @returns {Promise<Map<string, number[]>>} - Map of downloadId (string) to array of tag_id
   */
  async _buildTagsByDownloadId(matchingTorrents) {
    const userDb = await this.getUserDb();
    const allDownloadIds = matchingTorrents.flatMap((t) => {
      const id =
        t.id?.toString() ||
        t.torrent_id?.toString() ||
        t.usenet_id?.toString() ||
        t.web_id?.toString();
      return id ? [id] : [];
    });

    if (allDownloadIds.length === 0) {
      return new Map();
    }

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

    const tagsByDownloadId = new Map();
    for (const row of allDownloadTags) {
      const downloadId = String(row.download_id);
      if (!tagsByDownloadId.has(downloadId)) {
        tagsByDownloadId.set(downloadId, []);
      }
      tagsByDownloadId.get(downloadId).push(row.tag_id);
    }
    return tagsByDownloadId;
  }

  /**
   * Resolve tags map: use preloaded tags from RuleEvaluator when available;
   * fall back to a per-rule DB query when the evaluator did not load tags.
   * @param {Array} matchingTorrents
   * @param {Object} [options]
   * @returns {Promise<Map<string, number[]>>}
   */
  async _resolveTags(matchingTorrents, options = {}) {
    return options.tagsByDownloadId && options.tagsByDownloadId.size > 0
      ? options.tagsByDownloadId
      : await this._buildTagsByDownloadId(matchingTorrents);
  }

  /**
   * Filter torrents for add_tag action - skip torrents that already have all the tags
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @param {Object} [options] - Optional; tagsByDownloadId (Map<downloadId, Array<{id,name}>>) from RuleEvaluator
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForAddTag(matchingTorrents, action, options = {}) {
    if (action.type !== 'add_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingTorrents;
    }

    const tagsByDownloadId = await this._resolveTags(matchingTorrents, options);
    const targetTagIds = new Set(action.tagIds);
    const filtered = matchingTorrents.filter((torrent) => {
      const downloadId =
        torrent.id?.toString() ||
        torrent.torrent_id?.toString() ||
        torrent.usenet_id?.toString() ||
        torrent.web_id?.toString();
      if (!downloadId) {
        return true;
      }

      const existingTagIds = new Set(tagsByDownloadId.get(downloadId) || []);
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

  async filterForRemoveTag(matchingTorrents, action, options = {}) {
    if (action.type !== 'remove_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingTorrents;
    }

    const tagsByDownloadId = await this._resolveTags(matchingTorrents, options);
    const targetTagIds = new Set(action.tagIds);
    const filtered = matchingTorrents.filter((torrent) => {
      const downloadId =
        torrent.id?.toString() ||
        torrent.torrent_id?.toString() ||
        torrent.usenet_id?.toString() ||
        torrent.web_id?.toString();
      if (!downloadId) {
        return true;
      }

      const existingTagIds = new Set(tagsByDownloadId.get(downloadId) || []);
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

  normalizeBooleanValue(value) {
    return value === true || value === 1 || value === 'true';
  }

  filterForAddAirlock(matchingTorrents, action) {
    if (action.type !== 'add_airlock') {
      return matchingTorrents;
    }

    const filtered = matchingTorrents.filter((torrent) => {
      const isAirlocked = this.normalizeBooleanValue(torrent.airlocked);
      if (isAirlocked) {
        logger.debug('Skipping download - already airlocked', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
        });
        return false;
      }
      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered downloads that are already airlocked', {
        authId: this.authId,
        originalCount: matchingTorrents.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  filterForRemoveAirlock(matchingTorrents, action) {
    if (action.type !== 'remove_airlock') {
      return matchingTorrents;
    }

    const filtered = matchingTorrents.filter((torrent) => {
      const isAirlocked = this.normalizeBooleanValue(torrent.airlocked);
      if (!isAirlocked) {
        logger.debug('Skipping download - not airlocked', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
        });
        return false;
      }
      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered downloads that are not airlocked', {
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
   * Filter torrents for force_start action - only keep queued torrents.
   * force_start is only valid for queued torrents; inactive/seeding/etc. cannot be force-started.
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterForForceStart(matchingTorrents, action) {
    if (action.type !== 'force_start') {
      return matchingTorrents;
    }

    const filtered = matchingTorrents.filter((torrent) => {
      const isQueued = getTorrentStatus(torrent) === 'queued';

      if (!isQueued) {
        logger.debug('Skipping torrent for force_start - not queued', {
          authId: this.authId,
          torrentId: torrent.id,
          torrentName: torrent.name,
          status: getTorrentStatus(torrent),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingTorrents.length - filtered.length;
    if (skippedCount > 0) {
      logger.info('Filtered torrents for force_start (only queued allowed)', {
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
   * @param {Array} matchingTorrents - Torrents that matched the rule conditions
   * @param {Object} action - Action configuration
   * @param {Object} [options] - Optional; tagsByDownloadId from RuleEvaluator to avoid duplicate SELECT
   * @returns {Promise<Array>} - Filtered torrents
   */
  async filterTorrents(matchingTorrents, action, options = {}) {
    if (!action || !action.type) {
      return matchingTorrents;
    }

    switch (action.type) {
      case 'add_tag':
        return await this.filterForAddTag(matchingTorrents, action, options);
      case 'remove_tag':
        return await this.filterForRemoveTag(matchingTorrents, action, options);
      case 'add_airlock':
        return this.filterForAddAirlock(matchingTorrents, action);
      case 'remove_airlock':
        return this.filterForRemoveAirlock(matchingTorrents, action);
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
