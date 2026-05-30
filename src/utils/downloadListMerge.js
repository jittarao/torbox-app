/**
 * Pure merge + structural sharing for TorBox download lists.
 */

const ROW_COMPARE_FIELDS = [
  'id', 'name', 'size', 'progress', 'download_speed', 'upload_speed',
  'download_state', 'download_finished', 'download_present', 'active', 'eta',
  'peers', 'seeds', 'ratio', 'status', 'cached', 'error', 'tracker',
  'tracker_domain', 'tracker_icon', 'updated_at', 'expires_at', 'availability',
  'max_download_speed',
];

// Note: active items used to get a new reference on every poll, but now
// downloadRowEqual compares all ROW_COMPARE_FIELDS regardless of activity.
// This preserves structural sharing — items with no meaningful field change
// reuse the previous entity reference.

function fileListSignature(files) {
  if (!files?.length) return '';
  return files.map((f) => `${f.id}:${f.size ?? 0}`).join('|');
}

/**
 * Checks if a row is in a state where it could still change (active, downloading, etc.).
 * No longer forces new references — structural sharing applies to all items equally.
 * Used to avoid re-measuring rows that are known to be stable.
 */
export function isRowLikelyChanging(row) {
  if (!row) return false;
  if (row.active) return true;
  if (!row.download_finished) return true;
  const state = row.download_state || '';
  if (state.includes('downloading') || state === 'meta_dl' || state === 'checking_resume_data') {
    return true;
  }
  return false;
}

/**
 * @param {object} prev
 * @param {object} next — same shape, assetType already applied on next
 */
export function downloadRowEqual(prev, next) {
  if (!prev || !next) return false;
  if (prev.id !== next.id) return false;
  if (prev.assetType !== next.assetType) return false;

  for (const field of ROW_COMPARE_FIELDS) {
    if (prev[field] !== next[field]) return false;
  }

  if (fileListSignature(prev.files) !== fileListSignature(next.files)) {
    return false;
  }

  return true;
}

export function sortItemsNonMutating(items) {
  if (!items?.length) return [];
  return items.toSorted((a, b) => new Date(b.added || 0) - new Date(a.added || 0));
}

function applyDeltaToList(currentList, data, removed, assetType) {
  const removedSet = new Set(removed || []);
  let list = (currentList || []).filter((item) => !removedSet.has(item.id));
  const listIndexMap = new Map(list.map((i, idx) => [i.id, idx]));

  for (const item of data || []) {
    const withType = { ...item, assetType };
    const existingIdx = listIndexMap.get(item.id);
    if (existingIdx !== undefined) {
      list[existingIdx] = withType;
    } else {
      listIndexMap.set(item.id, list.length);
      list.push(withType);
    }
  }

  return list;
}

/**
 * Merge API payload into a list with ingest sort and structural sharing.
 *
 * @param {object[]} prevList
 * @param {{ delta?: boolean, data?: object[], removed?: (number|string)[] }} payload
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export function mergeDownloadList(prevList, payload, assetType) {
  const { delta, data, removed } = payload;
  let merged;

  if (delta === true) {
    merged = applyDeltaToList(prevList, data, removed, assetType);
  } else {
    merged = (data || []).map((item) => ({ ...item, assetType }));
  }

  const sorted = sortItemsNonMutating(merged);

  if (!prevList?.length) {
    return sorted;
  }

  const prevById = new Map(prevList.map((r) => [r.id, r]));
  return sorted.map((row) => {
    const tagged = row.assetType === assetType ? row : { ...row, assetType };
    const prev = prevById.get(tagged.id);
    return prev && downloadRowEqual(prev, tagged) ? prev : tagged;
  });
}

/**
 * Stable signature of item ids for selection revalidation (order-independent).
 * @param {object[]} items
 */
export function downloadListIdSignature(items) {
  if (!items?.length) return '';
  const ids = items.map((i) => `${i.assetType || 'torrents'}:${i.id}`);
  ids.sort();
  return ids.join(',');
}

/**
 * Signature for selection reconcile — ids plus per-item file lists (order-independent).
 * @param {object[]} items
 */
export function downloadListReconcileSignature(items) {
  if (!items?.length) return '';
  const parts = items.map((i) => {
    const id = `${i.assetType || 'torrents'}:${i.id}`;
    const files = fileListSignature(i.files);
    return files ? `${id}[${files}]` : id;
  });
  parts.sort();
  return parts.join(',');
}

/** @param {'torrents' | 'usenet' | 'webdl'} assetType @param {number|string} id */
export function entityKey(assetType, id) {
  return `${assetType}:${id}`;
}

/**
 * Apply merged list to normalized entities + order keys (structural sharing preserved).
 *
 * @param {Record<string, object>} prevEntities
 * @param {string[]} prevOrderKeys
 * @param {object[]} mergedList
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export function mergeListIntoEntities(prevEntities, prevOrderKeys, mergedList, assetType) {
  const nextEntities = { ...prevEntities };
  const nextOrder = [];
  const nextKeySet = new Set();

  for (const row of mergedList || []) {
    const key = entityKey(assetType, row.id);
    nextKeySet.add(key);
    const prev = prevEntities[key];
    nextEntities[key] = prev && downloadRowEqual(prev, row) ? prev : row;
    nextOrder.push(key);
  }

  for (const key of prevOrderKeys || []) {
    if (!nextKeySet.has(key)) {
      delete nextEntities[key];
    }
  }

  return { entities: nextEntities, orderKeys: nextOrder };
}

/**
 * @param {Record<string, object>} prevEntities
 * @param {string[]} prevOrderKeys
 * @param {{ delta?: boolean, data?: object[], removed?: (number|string)[] }} payload
 * @param {'torrents' | 'usenet' | 'webdl'} assetType
 */
export function mergeDownloadEntities(prevEntities, prevOrderKeys, payload, assetType) {
  const prevList = (prevOrderKeys || [])
    .map((key) => prevEntities[key])
    .filter(Boolean);
  const mergedList = mergeDownloadList(prevList, payload, assetType);
  return mergeListIntoEntities(prevEntities, prevOrderKeys, mergedList, assetType);
}
