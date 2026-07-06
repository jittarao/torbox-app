/**
 * Hostname extraction and labels for Source sidebar / active filter chips.
 */

/**
 * Strip leading `www.` from a hostname (case-insensitive).
 * @param {string} hostname
 * @returns {string}
 */
function stripWwwFromHostname(hostname) {
  const host = String(hostname ?? '');
  if (host.toLowerCase().startsWith('www.')) return host.slice(4);
  return host;
}

/**
 * Extract hostname (+ non-default port) from a webdl original_url.
 * @param {string|null|undefined} originalUrl
 * @returns {string}
 */
export function extractSourceHost(originalUrl) {
  const raw = String(originalUrl ?? '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const hostname = stripWwwFromHostname(parsed.hostname);
    const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    return host || '';
  } catch {
    return '';
  }
}

/**
 * Normalize a bare source host key (sidebar value / URL param).
 * @param {string|null|undefined} host
 * @returns {string}
 */
export function normalizeSourceHostKey(host) {
  const raw = String(host ?? '').trim();
  if (!raw) return '';

  const colonIdx = raw.lastIndexOf(':');
  if (colonIdx > 0) {
    const port = raw.slice(colonIdx + 1);
    if (/^\d+$/.test(port)) {
      const hostname = stripWwwFromHostname(raw.slice(0, colonIdx));
      return `${hostname}:${port}`;
    }
  }

  return stripWwwFromHostname(raw);
}

/**
 * Human-friendly label for a source host in sidebar / active filter chips.
 * @param {string|null|undefined} host
 * @returns {string}
 */
export function formatSourceLabel(host) {
  const raw = String(host ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 40) return raw;
  return `${raw.slice(0, 37)}…`;
}
