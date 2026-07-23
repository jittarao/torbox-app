/** Max in-flight airlock PUT requests during bulk lock/unlock (rolling pool). */
export const CONCURRENT_AIRLOCKS = 3;

export function normalizeBooleanValue(value) {
  return value === true || value === 1 || value === 'true';
}

export function normalizeUiAssetType(assetType) {
  return assetType === 'torrent' ? 'torrents' : assetType;
}
