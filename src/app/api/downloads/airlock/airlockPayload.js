export const EDIT_CONFIG = {
  torrent: {
    listEndpoint: '/api/torrents/mylist',
    editEndpoint: '/api/torrents/edittorrent',
    idField: 'torrent_id',
  },
  usenet: {
    listEndpoint: '/api/usenet/mylist',
    editEndpoint: '/api/usenet/editusenetdownload',
    idField: 'usenet_id',
  },
  webdl: {
    listEndpoint: '/api/webdl/mylist',
    editEndpoint: '/api/webdl/editwebdownload',
    idField: 'webdl_id',
  },
};

const MATCH_ID_FIELDS = ['id', 'torrent_id', 'usenet_id', 'webdl_id', 'web_id'];

const RESOURCE_ID_FIELDS = {
  torrent_id: ['torrent_id', 'id'],
  usenet_id: ['usenet_id', 'id'],
  webdl_id: ['webdl_id', 'web_id', 'id'],
};

export function normalizeAssetType(assetType) {
  if (assetType === 'torrents') return 'torrent';
  if (assetType === 'webdownload') return 'webdl';
  return assetType;
}

export function normalizeEditableArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * TorBox mylist rows may expose the resource id on `id` or a type-specific field.
 * @param {object} data
 * @param {string | number} id
 */
export function findDownloadById(data, id) {
  const items = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
  return (
    items.find((item) =>
      MATCH_ID_FIELDS.some((field) => item?.[field] != null && String(item[field]) === String(id))
    ) || null
  );
}

export function getAlternativeHashes(item) {
  return item?.alternative_hashes ?? item?.alternativeHashes;
}

/**
 * @param {object} item
 * @param {string} idField
 * @param {string | number} requestId
 */
export function resolveEditResourceId(item, idField, requestId) {
  const candidates = RESOURCE_ID_FIELDS[idField] || [idField, 'id'];
  for (const field of candidates) {
    const value = item?.[field];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return requestId;
}

/**
 * TorBox edit endpoints expect string tag names; enriched rows may carry { id, name }.
 * @param {unknown} tags
 */
export function normalizeEditTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => {
      if (typeof tag === 'string') return tag.trim();
      if (tag && typeof tag === 'object' && typeof tag.name === 'string') return tag.name.trim();
      return '';
    })
    .filter((tag) => tag.length > 0);
}

/**
 * TorBox rejects empty names on edit; preserve upstream name when possible.
 * @param {unknown} name
 * @param {string | number} resourceId
 */
export function normalizeEditName(name, resourceId) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length > 0) return trimmed;
  return `Download ${resourceId}`;
}

/**
 * @param {object} item
 * @param {string} idField
 * @param {boolean} airlocked
 * @param {string | number} requestId
 */
export function buildEditPayload(item, idField, airlocked, requestId) {
  const resourceId = resolveEditResourceId(item, idField, requestId);

  return {
    [idField]: resourceId,
    name: normalizeEditName(item?.name, resourceId),
    tags: normalizeEditTags(item?.tags),
    alternative_hashes: normalizeEditableArray(getAlternativeHashes(item)),
    airlocked,
  };
}

export const QUEUED_TYPE_BY_ASSET = {
  torrent: 'torrent',
  usenet: 'usenet',
  webdl: 'webdl',
};

export function isIdInQueuedList(queuedData, id) {
  const items = Array.isArray(queuedData?.data) ? queuedData.data : [];
  return items.some((item) =>
    MATCH_ID_FIELDS.some((field) => item?.[field] != null && String(item[field]) === String(id))
  );
}
