/**
 * Human-friendly label for a tracker URL in sidebar / active filter chips.
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function formatTrackerLabel(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw);
    const host = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
    if (host) return host;
  } catch {
    // fall through to truncated raw string
  }

  if (raw.length <= 40) return raw;
  return `${raw.slice(0, 37)}…`;
}
