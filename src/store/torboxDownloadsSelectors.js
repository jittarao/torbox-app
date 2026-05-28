/**
 * Pure selectors for torboxDownloadsStore (no React).
 */

/**
 * @param {{ torrents?: object[], usenet?: object[], webdl?: object[] }} state
 * @param {'torrents' | 'usenet' | 'webdl' | 'all'} viewType
 */
export function selectItemsForView(state, viewType) {
  switch (viewType) {
    case 'all':
      return [...(state.torrents || []), ...(state.usenet || []), ...(state.webdl || [])];
    case 'usenet':
      return state.usenet || [];
    case 'webdl':
      return state.webdl || [];
    default:
      return state.torrents || [];
  }
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
  switch (viewType) {
    case 'all':
      return (
        (state.torrents?.length || 0) +
          (state.usenet?.length || 0) +
          (state.webdl?.length || 0) >
        0
      );
    case 'usenet':
      return (state.usenet?.length || 0) > 0;
    case 'webdl':
      return (state.webdl?.length || 0) > 0;
    default:
      return (state.torrents?.length || 0) > 0;
  }
}
