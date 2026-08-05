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
  // Sequential per asset type to avoid holding 2–3 full mylist JSON arrays at once
  // (multi-asset rules × MAX_CONCURRENT_POLLS was a peak-RAM multiplier).
  const parts = [];

  if (types.has('torrent')) {
    parts.push(
      tagDownloadsWithAssetType(
        await apiClient.getTorrents(bypassCache, { forAutomationRules: true }),
        'torrent'
      )
    );
  }
  if (types.has('usenet')) {
    parts.push(
      tagDownloadsWithAssetType(
        await apiClient.getUsenetDownloads(bypassCache, { forAutomationRules: true }),
        'usenet'
      )
    );
  }
  if (types.has('webdl')) {
    parts.push(
      tagDownloadsWithAssetType(
        await apiClient.getWebDownloads(bypassCache, { forAutomationRules: true }),
        'webdl'
      )
    );
  }

  return parts.flat();
}
