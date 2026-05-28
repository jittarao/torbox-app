/**
 * Selection keys for download rows (stable on All tab across asset types).
 */

/**
 * @param {{ id: number|string, assetType?: string, asset_type?: string }} item
 */
export function getDownloadSelectionId(item) {
  if (!item) return '';
  const assetType = item.assetType || item.asset_type || 'torrents';
  return `${assetType}:${item.id}`;
}

/**
 * @param {string|number} storedId — legacy numeric id or composite key
 * @param {object} item
 */
export function selectionIdMatchesItem(storedId, item) {
  if (storedId == null || !item) return false;
  const composite = getDownloadSelectionId(item);
  if (typeof storedId === 'string' && storedId.includes(':')) {
    return storedId === composite;
  }
  const numeric = typeof storedId === 'number' ? storedId : parseInt(storedId, 10);
  return item.id === numeric || item.id === storedId;
}

/**
 * @param {object[]} items
 * @param {string|number} selectionId
 */
export function findItemBySelectionId(items, selectionId) {
  if (!items?.length || selectionId == null) return undefined;
  return items.find((item) => selectionIdMatchesItem(selectionId, item));
}
