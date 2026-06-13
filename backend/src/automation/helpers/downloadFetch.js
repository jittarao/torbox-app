/**
 * Fetch and normalize downloads across asset types for automation polling.
 */

/**
 * @param {Array<{ assetTypes?: string[] }>} rules
 * @returns {string[]}
 */
export function getUnionAssetTypesFromRules(rules) {
  const set = new Set();
  for (const rule of rules || []) {
    const types = rule?.assetTypes;
    if (Array.isArray(types)) {
      for (const t of types) set.add(t);
    }
  }
  if (set.size === 0) set.add('torrent');
  return [...set].sort();
}

/**
 * @param {Array} items
 * @param {string} assetType
 * @param {{ fromQueued?: boolean }} [options]
 * @returns {Array}
 */
export function tagDownloadsWithAssetType(items, assetType, options = {}) {
  const { fromQueued = false } = options;
  return (items || []).map((item) => ({
    ...item,
    assetType,
    ...(fromQueued ? { status: 'queued' } : {}),
  }));
}

/**
 * @param {import('../../api/ApiClient.js').default} apiClient
 * @param {string[]} assetTypes
 * @param {boolean} [bypassCache]
 * @returns {Promise<Array>}
 */
export async function fetchDownloadsForAssetTypes(apiClient, assetTypes, bypassCache = false) {
  const types = new Set(assetTypes?.length ? assetTypes : ['torrent']);
  const fetches = [];

  if (types.has('torrent')) {
    fetches.push(
      apiClient.getTorrents(bypassCache).then((list) => tagDownloadsWithAssetType(list, 'torrent'))
    );
  }
  if (types.has('usenet')) {
    fetches.push(
      apiClient
        .getUsenetDownloads(bypassCache)
        .then((list) => tagDownloadsWithAssetType(list, 'usenet'))
    );
  }
  if (types.has('webdl')) {
    fetches.push(
      apiClient
        .getWebDownloads(bypassCache)
        .then((list) => tagDownloadsWithAssetType(list, 'webdl'))
    );
  }

  const parts = await Promise.all(fetches);
  return parts.flat();
}
