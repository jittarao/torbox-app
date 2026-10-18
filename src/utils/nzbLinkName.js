/**
 * Names for an NZB added by link.
 *
 * Precedence for the discovered filename:
 * 1. Content-Disposition `filename*` (RFC 5987), then `filename`, from the
 *    final response after redirects
 * 2. Basename of the final URL when it has a real file extension
 * 3. Basename of the original URL when it has a real file extension
 * 4. A stable generated fallback
 *
 * The result is a single basename. Query strings and API keys are never kept.
 */

const PLACEHOLDER_SLOT =
  /^(unknown|httpsapi)$|^nzb-[0-9a-f]{8}$| - NZB Download$/i;

function unquote(value) {
  const text = String(value ?? '').trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return text;
}

function decodeRfc5987(value) {
  const unquoted = unquote(value).trim();
  const match = /^([^']*)'[^']*'(.*)$/s.exec(unquoted);
  const encoded = match ? match[2] : unquoted;
  try {
    return decodeURIComponent(encoded.replace(/\+/g, '%20'));
  } catch {
    return encoded;
  }
}

function splitHeaderParams(header) {
  const params = [];
  let current = '';
  let inQuotes = false;

  for (const char of String(header)) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (char === ';' && !inQuotes) {
      params.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  params.push(current);

  return params
    .map((part) => part.trim())
    .filter((part) => part.includes('='))
    .map((part) => {
      const eq = part.indexOf('=');
      return {
        name: part.slice(0, eq).trim().toLowerCase(),
        value: part.slice(eq + 1).trim(),
      };
    });
}

/**
 * First valid filename from a Content-Disposition header.
 * `filename*` wins over `filename`. Later duplicates are used only when the
 * earlier value is empty or unsafe.
 * @param {string} header
 * @returns {string|null}
 */
export function parseContentDispositionFilename(header) {
  if (!header || typeof header !== 'string') return null;
  const clean = header.replace(/[\r\n]+/g, ' ');
  const params = splitHeaderParams(clean);
  const stars = params.filter((param) => param.name === 'filename*');
  const plains = params.filter((param) => param.name === 'filename');

  for (const param of stars) {
    const safe = sanitizeDownloadBasename(decodeRfc5987(param.value));
    if (safe) return safe;
  }
  for (const param of plains) {
    const safe = sanitizeDownloadBasename(unquote(param.value));
    if (safe) return safe;
  }
  return null;
}

/**
 * Reduce a candidate to a single safe basename, or null when nothing usable remains.
 * @param {string} raw
 * @returns {string|null}
 */
export function sanitizeDownloadBasename(raw) {
  if (raw == null) return null;
  let value = String(raw).replace(/^\uFEFF/, '').trim();
  if (!value) return null;

  value = value.split('?')[0].split('#')[0];
  const segments = value.split(/[/\\]/).filter(Boolean);
  value = segments.length ? segments[segments.length - 1] : '';
  value = value.replace(/[<>:"|?*\u0000-\u001f\u007f]/g, '_').trim();
  value = value.replace(/[. ]+$/g, '');

  if (!value || value === '.' || value === '..' || value === '_') return null;
  if (/^https?:/i.test(value) || value.includes('://') || /apikey=/i.test(value)) return null;
  if (value.length > 180) {
    const ext = value.toLowerCase().endsWith('.nzb') ? '.nzb' : '';
    value = `${value.slice(0, 180 - ext.length)}${ext}`;
  }
  return value;
}

/**
 * Basename of a URL path when it looks like a file (`name.ext`), not a route (`api`).
 * @param {string} url
 * @returns {string|null}
 */
export function filenameFromUrlPath(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segment = parsed.pathname.split('/').filter(Boolean).pop() || '';
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  const base = sanitizeDownloadBasename(decoded);
  if (!base || !/\.[a-z0-9]{1,8}$/i.test(base)) return null;
  return base;
}

/** Stable 8-hex FNV-1a. The input is not copied into the result. */
export function stableNzbFallbackName(source) {
  let hash = 0x811c9dc5;
  const bytes = new TextEncoder().encode(String(source ?? ''));
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return `nzb-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function isPlaceholderNzbSlotName(name) {
  if (name == null) return true;
  const value = String(name).trim();
  if (!value) return true;
  if (value.endsWith('...')) return true;
  if (value.includes('://') || value.includes('?') || /apikey=/i.test(value)) return true;
  return PLACEHOLDER_SLOT.test(value);
}

function stripNzbExtension(name) {
  return String(name).replace(/\.nzb$/i, '') || name;
}

/**
 * @param {string} name
 * @returns {string}
 */
export function ensureNzbFilename(name) {
  const base = sanitizeDownloadBasename(name) || 'download.nzb';
  return base.toLowerCase().endsWith('.nzb') ? base : `${base}.nzb`;
}

/**
 * Slot label and multipart filename for one Usenet link.
 * A real caller-supplied title is kept for the slot. The file name prefers
 * the discovered NZB filename so a URL like `https://api…` never becomes `httpsapi`.
 *
 * @param {{ sourceUrl?: string, finalUrl?: string, contentDisposition?: string, existingName?: string }} input
 * @returns {{ slotName: string, fileName: string }}
 */
export function resolveUsenetUploadNames({
  sourceUrl,
  finalUrl,
  contentDisposition,
  existingName,
} = {}) {
  const fromHeader = parseContentDispositionFilename(contentDisposition);
  const fromFinal = filenameFromUrlPath(finalUrl);
  const fromSource = filenameFromUrlPath(sourceUrl);
  const discovered = fromHeader || fromFinal || fromSource;
  const fallback = stableNzbFallbackName(sourceUrl || finalUrl || '');
  const autoSlot = fromSource ? stripNzbExtension(fromSource) : null;
  const safeExisting = sanitizeDownloadBasename(existingName);
  const existingIsAutomatic =
    isPlaceholderNzbSlotName(existingName) ||
    (safeExisting && autoSlot && safeExisting === autoSlot) ||
    (safeExisting && safeExisting === fallback);

  const userName = !existingIsAutomatic ? safeExisting : null;

  const slotSource = userName || (discovered ? stripNzbExtension(discovered) : null) || fallback;
  const fileName = ensureNzbFilename(discovered || userName || fallback);

  return { slotName: slotSource, fileName };
}
