import logger from '../../utils/logger.js';
import { getTorrentStatus } from '../../utils/torrentStatus.js';

/**
 * Helper for filtering downloads based on rule actions
 */
class RuleFilter {
  constructor(authId, getUserDb) {
    this.authId = authId;
    this.getUserDb = getUserDb;
  }

  /**
   * Build a map of download ID -> tag IDs from the database for the given downloads.
   * @param {Array} matchingDownloads - Downloads to look up tags for
   * @returns {Promise<Map<string, number[]>>} - Map of downloadId (string) to array of tag_id
   */
  async _buildTagsByDownloadId(matchingDownloads) {
    const userDb = await this.getUserDb();
    const allDownloadIds = matchingDownloads.flatMap((t) => {
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
   * Normalize tag ids for stable Set membership (SQLite may return strings).
   * @param {Array<number|string>} tagIds
   * @returns {Set<number>}
   */
  _normalizeTagIdSet(tagIds) {
    return new Set((tagIds || []).map((id) => Number(id)));
  }

  /**
   * @param {Set<number>} existingTagIds
   * @param {Set<number>} targetTagIds
   * @returns {boolean}
   */
  _hasAllTargetTags(existingTagIds, targetTagIds) {
    for (const tagId of targetTagIds) {
      if (!existingTagIds.has(tagId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Filter downloads for add_tag action - skip downloads that already have all the tags
   * @param {Array} matchingDownloads - Downloads that matched the rule conditions
   * @param {Object} action - Action configuration
   * @param {Object} [options] - Optional; tagsByDownloadId (Map<downloadId, Array<{id,name}>>) from RuleEvaluator
   * @returns {Promise<Array>} - Filtered downloads
   */
  async filterForAddTag(matchingDownloads, action, options = {}) {
    if (action.type !== 'add_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingDownloads;
    }

    // Always load tags for matching downloads — batch preloads can be stale or keyed differently.
    const tagsByDownloadId = await this._buildTagsByDownloadId(matchingDownloads);
    const targetTagIds = this._normalizeTagIdSet(action.tagIds);
    const filtered = matchingDownloads.filter((download) => {
      const downloadId =
        download.id?.toString() ||
        download.torrent_id?.toString() ||
        download.usenet_id?.toString() ||
        download.web_id?.toString();
      if (!downloadId) {
        return true;
      }

      const existingTagIds = this._normalizeTagIdSet(tagsByDownloadId.get(downloadId) || []);
      const hasAllTags = this._hasAllTargetTags(existingTagIds, targetTagIds);

      if (hasAllTags) {
        logger.debug('Skipping download - already has all tags', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
          existingTagIds: Array.from(existingTagIds),
          targetTagIds: Array.from(targetTagIds),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads that already have all tags', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  async filterForRemoveTag(matchingDownloads, action, options = {}) {
    if (action.type !== 'remove_tag' || !action.tagIds || action.tagIds.length === 0) {
      return matchingDownloads;
    }

    const tagsByDownloadId = await this._buildTagsByDownloadId(matchingDownloads);
    const targetTagIds = this._normalizeTagIdSet(action.tagIds);
    const filtered = matchingDownloads.filter((download) => {
      const downloadId =
        download.id?.toString() ||
        download.torrent_id?.toString() ||
        download.usenet_id?.toString() ||
        download.web_id?.toString();
      if (!downloadId) {
        return true;
      }

      const existingTagIds = this._normalizeTagIdSet(tagsByDownloadId.get(downloadId) || []);
      const hasAnyTag = [...targetTagIds].some((tagId) => existingTagIds.has(tagId));

      if (!hasAnyTag) {
        logger.debug('Skipping download - does not have any tags to remove', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
          existingTagIds: Array.from(existingTagIds),
          targetTagIds: Array.from(targetTagIds),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads that do not have tags to remove', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  normalizeBooleanValue(value) {
    return value === true || value === 1 || value === 'true';
  }

  filterForAddAirlock(matchingDownloads, action) {
    if (action.type !== 'add_airlock') {
      return matchingDownloads;
    }

    const filtered = matchingDownloads.filter((download) => {
      const isAirlocked = this.normalizeBooleanValue(download.airlocked);
      if (isAirlocked) {
        logger.debug('Skipping download - already airlocked', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
        });
        return false;
      }
      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads that are already airlocked', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  filterForRemoveAirlock(matchingDownloads, action) {
    if (action.type !== 'remove_airlock') {
      return matchingDownloads;
    }

    const filtered = matchingDownloads.filter((download) => {
      const isAirlocked = this.normalizeBooleanValue(download.airlocked);
      if (!isAirlocked) {
        logger.debug('Skipping download - not airlocked', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
        });
        return false;
      }
      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads that are not airlocked', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter downloads for stop_seeding action - skip downloads that are not currently seeding
   * @param {Array} matchingDownloads - Downloads that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered downloads
   */
  async filterForStopSeeding(matchingDownloads, action) {
    if (action.type !== 'stop_seeding') {
      return matchingDownloads;
    }

    const filtered = matchingDownloads.filter((download) => {
      const status = getTorrentStatus(download);
      const isSeeding = status === 'seeding';

      if (!isSeeding) {
        logger.debug('Skipping download - not currently seeding', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
          status,
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads that are not seeding', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter downloads for force_start action - only keep queued downloads.
   * force_start is only valid for queued downloads; inactive/seeding/etc. cannot be force-started.
   * @param {Array} matchingDownloads - Downloads that matched the rule conditions
   * @param {Object} action - Action configuration
   * @returns {Promise<Array>} - Filtered downloads
   */
  async filterForForceStart(matchingDownloads, action) {
    if (action.type !== 'force_start') {
      return matchingDownloads;
    }

    const filtered = matchingDownloads.filter((download) => {
      const isQueued = getTorrentStatus(download) === 'queued';

      if (!isQueued) {
        logger.debug('Skipping download for force_start - not queued', {
          authId: this.authId,
          torrentId: download.id,
          torrentName: download.name,
          status: getTorrentStatus(download),
        });
        return false;
      }

      return true;
    });

    const skippedCount = matchingDownloads.length - filtered.length;
    if (skippedCount > 0) {
      logger.debug('Filtered downloads for force_start (only queued allowed)', {
        authId: this.authId,
        originalCount: matchingDownloads.length,
        filteredCount: filtered.length,
        skippedCount,
      });
    }

    return filtered;
  }

  /**
   * Filter downloads based on action type
   * @param {Array} matchingDownloads - Downloads that matched the rule conditions
   * @param {Object} action - Action configuration
   * @param {Object} [options] - Optional; tagsByDownloadId from RuleEvaluator to avoid duplicate SELECT
   * @returns {Promise<Array>} - Filtered downloads
   */
  async filterDownloads(matchingDownloads, action, options = {}) {
    if (!action || !action.type) {
      return matchingDownloads;
    }

    switch (action.type) {
      case 'add_tag':
        return await this.filterForAddTag(matchingDownloads, action, options);
      case 'remove_tag':
        return await this.filterForRemoveTag(matchingDownloads, action, options);
      case 'add_airlock':
        return this.filterForAddAirlock(matchingDownloads, action);
      case 'remove_airlock':
        return this.filterForRemoveAirlock(matchingDownloads, action);
      case 'stop_seeding':
        return await this.filterForStopSeeding(matchingDownloads, action);
      case 'force_start':
        return await this.filterForForceStart(matchingDownloads, action);
      case 'archive':
      case 'delete':
        // Archive and delete actions don't need filtering
        // Archived downloads are removed from main list
        // Delete action removes downloads completely
        return matchingDownloads;
      default:
        // Unknown action type, don't filter
        logger.warn('Unknown action type, skipping filter', {
          authId: this.authId,
          actionType: action.type,
        });
        return matchingDownloads;
    }
  }
}

export default RuleFilter;
