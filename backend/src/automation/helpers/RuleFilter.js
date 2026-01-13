import logger from '../../utils/logger.js';

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
}

export default RuleFilter;
