/**
 * TorBox upload API response validation (see prompts/torbox-api.md).
 *
 * Standard envelope for POST /torrents/createtorrent, /usenet/createusenetdownload,
 * and /webdl/createwebdownload:
 *   { success, error, detail, data }
 * Use `success` (not HTTP status alone) to decide outcome; failures may still be HTTP 200.
 *
 * createtorrent success `data` (documented):
 *   { hash, torrent_id, auth_id }
 * mylist items use `id`; create responses use type-specific ids per /torrents vs /usenet vs /webdl.
 */

/** @type {Record<string, string[]>} */
export const UPLOAD_RESOURCE_ID_KEYS = {
  torrent: ['torrent_id', 'id'],
  usenet: ['usenet_id', 'id'],
  webdl: ['webdl_id', 'web_id', 'id'],
};

/**
 * Extract a resource id from TorBox `data` for a create-* response.
 * @param {unknown} payload - TorBox `data` field from the API envelope
 * @param {string} [uploadType] - torrent | usenet | webdl
 * @returns {string|number|null}
 */
export function getUploadResourceId(payload, uploadType) {
  if (payload == null) return null;
  if (typeof payload === 'number') {
    return Number.isFinite(payload) ? payload : null;
  }
  if (typeof payload === 'string') {
    return payload.length > 0 ? payload : null;
  }
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const keys = UPLOAD_RESOURCE_ID_KEYS[uploadType] || [
    'torrent_id',
    'usenet_id',
    'webdl_id',
    'web_id',
    'id',
  ];

  for (const key of keys) {
    const value = payload[key];
    if (value != null && String(value) !== '') {
      return value;
    }
  }

  return null;
}

/**
 * @param {unknown} payload - TorBox `data` field from the API envelope
 * @param {string} [uploadType] - torrent | usenet | webdl
 * @returns {boolean}
 */
export function hasUploadResourcePayload(payload, uploadType) {
  return getUploadResourceId(payload, uploadType) != null;
}

/**
 * @param {Object|undefined} response - Axios response ({ data, status })
 * @param {string} [uploadType] - torrent | usenet | webdl
 * @returns {boolean} True when TorBox confirms the upload resource was created
 */
export function isTorboxUploadApiSuccess(response, uploadType) {
  const envelope = response?.data;
  if (envelope == null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return false;
  }
  if (envelope.success === false) return false;
  if (envelope.error != null && envelope.error !== '') return false;
  if (envelope.success !== true) return false;
  return hasUploadResourcePayload(envelope.data, uploadType);
}

/**
 * @param {Object|undefined} response - Axios response ({ data })
 * @param {string} [uploadType] - torrent | usenet | webdl
 * @returns {boolean}
 */
export function isTorboxUploadApiFailure(response, uploadType) {
  return !isTorboxUploadApiSuccess(response, uploadType);
}
