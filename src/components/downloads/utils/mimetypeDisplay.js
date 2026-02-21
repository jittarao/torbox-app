/**
 * Corrects API-reported mimetypes for display when the backend misidentifies
 * (e.g. .m4b reported as video/mp4). Add new overrides here as needed.
 *
 * Key format: "extension:reportedMimetype" -> display value
 */
const MIMETYPE_OVERRIDES = {
  'm4b:video/mp4': 'audio/m4b',
};

/**
 * @param {string} mimetype - Mimetype from API
 * @param {string} [filename] - File name (e.g. file.name) to infer extension
 * @returns {string} Mimetype string suitable for display
 */
export function getDisplayMimetype(mimetype, filename = '') {
  if (!mimetype) return '';
  const ext = filename ? (filename.split('.').pop() || '').toLowerCase() : '';
  const key = ext ? `${ext}:${mimetype}` : null;
  return (key && MIMETYPE_OVERRIDES[key]) || mimetype;
}
