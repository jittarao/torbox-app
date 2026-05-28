/**
 * TorBox Manager overlays on TorBox API download items.
 *
 * - `items` (Downloads.js) — raw list from the TorBox API
 * - `enrichedDownloads` — same list with TBM backend fields (tags, link-history flags, …)
 */

/**
 * Build Sets for O(1) link-history lookups (item-level and per-file).
 * @param {Array<{ assetType: string, itemId: string|number, fileId?: string|number|null }>} downloadHistory
 */
export function buildDownloadHistoryLookup(downloadHistory) {
  const itemDownloads = new Set();
  const fileDownloads = new Set();

  for (const download of downloadHistory || []) {
    const itemKey = `${download.assetType}:${String(download.itemId)}`;
    if (download.fileId == null) {
      itemDownloads.add(itemKey);
      continue;
    }
    fileDownloads.add(`${itemKey}:${String(download.fileId)}`);
  }

  return { itemDownloads, fileDownloads };
}

/**
 * Whether the user has generated a download link for the whole item (matches row highlight).
 */
function isItemDownloaded(item, lookup) {
  if (!item || !lookup) return false;
  const assetType = item.assetType || item.asset_type;
  if (!assetType) return false;
  return lookup.itemDownloads.has(`${assetType}:${String(item.id)}`);
}

/**
 * Whether a specific file within a multi-file item was downloaded.
 */
function isFileDownloaded(item, fileId, lookup) {
  if (!item || !lookup) return false;
  const assetType = item.assetType || item.asset_type;
  if (!assetType) return false;
  const itemKey = `${assetType}:${String(item.id)}`;
  return (
    lookup.itemDownloads.has(itemKey) || lookup.fileDownloads.has(`${itemKey}:${String(fileId)}`)
  );
}

/** Add link-history `is_downloaded` for filters and view counts. */
function applyLinkHistoryToDownloads(downloads, lookupOrHistory) {
  if (!downloads?.length) return downloads || [];
  const lookup =
    lookupOrHistory?.itemDownloads != null
      ? lookupOrHistory
      : buildDownloadHistoryLookup(lookupOrHistory);
  return downloads.map((download) => {
    const is_downloaded = isItemDownloaded(download, lookup);
    if (download.is_downloaded === is_downloaded) return download;
    return { ...download, is_downloaded };
  });
}

/**
 * Merge TBM backend data onto TorBox API downloads (tags, then link history).
 * @param {Array} torboxDownloads — raw TorBox API items
 * @param {(downloads: Array) => Array} mapTagsToDownloads — from useDownloadTags
 * @param {Array} downloadHistory — link history from TBM backend
 */
/**
 * @param {Array} torboxDownloads
 * @param {(downloads: Array) => Array} mapTagsToDownloads
 * @param {Array|{ itemDownloads: Set, fileDownloads: Set }} downloadHistoryOrLookup
 */
export function enrichDownloadsWithTbm(
  torboxDownloads,
  mapTagsToDownloads,
  downloadHistoryOrLookup
) {
  if (!torboxDownloads?.length) return torboxDownloads || [];
  const tagged = mapTagsToDownloads(torboxDownloads);
  return applyLinkHistoryToDownloads(tagged, downloadHistoryOrLookup);
}
