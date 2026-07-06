/**
 * Hostname extraction and labels for Source sidebar / active filter chips.
 */

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
    const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    return host || '';
  } catch {
    return '';
  }
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
