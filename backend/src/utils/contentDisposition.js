/**
 * Build a safe `Content-Disposition: attachment` header value.
 *
 * HTTP header values must be ISO-8859-1/latin1; filenames with non-ASCII
 * characters (e.g. "Thu Phương.torrent") throw ERR_INVALID_CHAR when set
 * directly. Emit an ASCII fallback plus the RFC 5987 `filename*` form so
 * modern clients recover the exact Unicode name.
 *
 * @param {string} filename
 * @param {string} [fallbackName]
 * @returns {string}
 */
export function buildAttachmentContentDisposition(filename, fallbackName = 'download') {
  const raw = String(filename ?? '').trim() || fallbackName;

  // Strip CR/LF (header injection) and any non-ASCII / control characters.
  const asciiFallback = raw
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
    .slice(0, 200);

  return `attachment; filename="${asciiFallback || fallbackName}"; filename*=UTF-8''${encodeRFC5987(raw)}`;
}

function encodeRFC5987(value) {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export default buildAttachmentContentDisposition;
