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
  if (Number.isNaN(numeric)) return item.id === storedId;
  return item.id === numeric || item.id === storedId;
}

/**
 * Build a Map from selectionId → item for O(1) lookups.
 * @param {object[]} items
 * @returns {Map<string, object>}
 */
export function buildSelectionIdMap(items) {
  const map = new Map();
  if (!items?.length) return map;
  for (const item of items) {
    map.set(getDownloadSelectionId(item), item);
  }
  return map;
}

/**
 * @param {object[]} items
 * @param {string|number} selectionId
 */
export function findItemBySelectionId(items, selectionId) {
  if (!items?.length || selectionId == null) return undefined;
  return items.find((item) => selectionIdMatchesItem(selectionId, item));
}
