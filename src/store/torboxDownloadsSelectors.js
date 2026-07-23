/**
 * Pure selectors for torboxDownloadsStore (no React).
 */

import { entityKey } from '@/utils/downloadListMerge';
import { isQueuedItem } from '@/utils/utility';

const emptyOrder = { torrents: [], usenet: [], webdl: [] };

/**
 * @param {{ order?: { torrents?: string[], usenet?: string[], webdl?: string[] } }} state
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} viewType
 * @returns {string[]}
 */
export function selectViewOrderedIds(state, viewType) {
  const order = state.order || emptyOrder;

  switch (viewType) {
    case 'all': {
      const t = order.torrents || [];
      const u = order.usenet || [];
      const w = order.webdl || [];
      return [...t, ...u, ...w];
    }
    case 'usenet':
      return order.usenet || [];
    case 'webdl':
      return order.webdl || [];
    default:
      return order.torrents || [];
  }
}

/**
 * @param {{ entities?: Record<string, object>, order?: object }} state
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} viewType
 */
export function selectItemsForView(state, viewType) {
  const entities = state.entities || {};
  const ids = selectViewOrderedIds(state, viewType);
  const rows = [];
  for (let i = 0; i < ids.length; i++) {
    const row = entities[ids[i]];
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * @param {{ entities?: Record<string, object> }} state
 * @param {string} key — `${assetType}:${id}`
 */
function selectEntity(state, key) {
  return state.entities?.[key];
}

/**
 * @param {object} item
 * @param {string} [activeType] — UI tab; may be 'all'
 */
export function resolveItemAssetType(item, activeType) {
  if (item?.assetType) return item.assetType;
  if (item?.asset_type) return item.asset_type;
  if (activeType && activeType !== 'all') return activeType;
  return 'torrents';
}

/**
 * TorBox API id field for download/stream requests.
 * @param {object} [item]
 * @param {string} [activeType] — UI tab; may be 'all'
 */
export function getIdFieldForItem(item, activeType) {
  const asset = resolveItemAssetType(item, activeType);
  if (asset === 'usenet') return 'usenet_id';
  if (asset === 'webdl') return 'web_id';
  return 'torrent_id';
}

export function getListKeyForAssetType(assetType) {
  switch (assetType) {
    case 'usenet':
      return 'usenet';
    case 'webdl':
      return 'webdl';
    default:
      return 'torrents';
  }
}

export function hasCachedDataForView(state, viewType) {
  const order = state.order || emptyOrder;
  switch (viewType) {
    case 'all':
      return (
        (order.torrents?.length || 0) + (order.usenet?.length || 0) + (order.webdl?.length || 0) > 0
      );
    case 'usenet':
      return (order.usenet?.length || 0) > 0;
    case 'webdl':
      return (order.webdl?.length || 0) > 0;
    default:
      return (order.torrents?.length || 0) > 0;
  }
}

export function selectHasQueuedTorrents(state) {
  const orderKeys = state.order?.torrents;
  if (!orderKeys?.length) return false;
  const entities = state.entities || {};
  for (let i = 0; i < orderKeys.length; i++) {
    const row = entities[orderKeys[i]];
    if (row && isQueuedItem(row)) return true;
  }
  return false;
}

export { entityKey };
