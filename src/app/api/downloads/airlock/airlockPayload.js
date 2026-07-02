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

export function normalizeAssetType(assetType) {
  if (assetType === 'torrents') return 'torrent';
  if (assetType === 'webdownload') return 'webdl';
  return assetType;
}

export function normalizeEditableArray(value) {
  return Array.isArray(value) ? value : [];
}

export function findDownloadById(data, id) {
  const items = Array.isArray(data?.data) ? data.data : data?.data ? [data.data] : [];
  return items.find((item) => String(item.id) === String(id)) || null;
}

export function buildEditPayload(item, idField, airlocked) {
  return {
    [idField]: item.id,
    name: item.name || '',
    tags: normalizeEditableArray(item.tags),
    alternative_hashes: normalizeEditableArray(item.alternative_hashes),
    airlocked,
  };
}
