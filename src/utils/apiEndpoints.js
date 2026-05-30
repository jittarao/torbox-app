export const ASSET_TYPE_ENDPOINTS = {
  torrents: '/api/torrents',
  usenet: '/api/usenet',
  webdl: '/api/webdl',
};

export function getEndpointForAssetType(assetType = 'torrents') {
  return ASSET_TYPE_ENDPOINTS[assetType] || ASSET_TYPE_ENDPOINTS.torrents;
}
