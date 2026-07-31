/**
 * Media ID parsing and type inference for Stremio stream search.
 */

export const FALLBACK_ID_PREFIXES = ['tt', 'anilist', 'kitsu', 'mal', 'anidb', 'tmdb', 'tvdb'];

const ANIME_PREFIXES = new Set(['anilist', 'kitsu', 'mal', 'anidb']);

/**
 * @param {string} raw
 * @param {string[]} [installedPrefixes]
 * @returns {{ ok: true, mediaId: string } | { ok: false, error: string }}
 */
export function parseMediaId(raw, installedPrefixes = []) {
  const mediaId = String(raw || '').trim();
  if (!mediaId) {
    return { ok: false, error: 'empty' };
  }

  // IMDb movie/show: tt1234567
  if (/^tt\d+$/i.test(mediaId)) {
    return { ok: true, mediaId: mediaId.toLowerCase() };
  }

  // IMDb episode: tt1234567:1:1
  if (/^tt\d+:\d+:\d+$/i.test(mediaId)) {
    const [id, s, e] = mediaId.split(':');
    return { ok: true, mediaId: `${id.toLowerCase()}:${s}:${e}` };
  }

  const prefixMatch = mediaId.match(/^([a-zA-Z][a-zA-Z0-9]*):(.+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase();
    const rest = prefixMatch[2].trim();
    if (!rest) {
      return { ok: false, error: 'invalid' };
    }
    const allowed = new Set([
      ...FALLBACK_ID_PREFIXES,
      ...(installedPrefixes || []).map((p) => String(p).toLowerCase()),
    ]);
    if (!allowed.has(prefix)) {
      return { ok: false, error: 'unknown_prefix' };
    }
    return { ok: true, mediaId: `${prefix}:${rest}` };
  }

  return { ok: false, error: 'invalid' };
}

/**
 * Infer which Stremio content types to query for a media ID.
 * @returns {string[]}
 */
export function inferTypesForMediaId(mediaId) {
  const id = String(mediaId || '');

  if (/^tt\d+:\d+:\d+$/i.test(id)) {
    return ['series'];
  }

  if (/^tt\d+$/i.test(id)) {
    return ['movie', 'series'];
  }

  // tmdb:{id}:{S}:{E} episode form
  if (/^tmdb:\d+:\d+:\d+$/i.test(id)) {
    return ['series'];
  }

  const prefixMatch = id.match(/^([a-zA-Z][a-zA-Z0-9]*):/);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase();
    if (ANIME_PREFIXES.has(prefix)) {
      return ['anime'];
    }
  }

  // Unknown but validated prefix — let callers query all matching addon types
  return ['movie', 'series', 'anime'];
}

/**
 * Whether an addon should be queried for this mediaId + type.
 */
export function addonSupportsQuery(addon, mediaId, type) {
  if (!addon?.enabled) return false;

  const types = Array.isArray(addon.types) ? addon.types : [];
  if (types.length > 0 && !types.includes(type)) return false;

  const prefixes = Array.isArray(addon.id_prefixes) ? addon.id_prefixes : [];
  if (prefixes.length === 0) return true;

  const id = String(mediaId || '');
  return prefixes.some((prefix) => {
    const p = String(prefix).toLowerCase();
    if (p === 'tt') return /^tt\d+/i.test(id);
    return id.toLowerCase().startsWith(`${p}:`);
  });
}

/**
 * Collect unique id prefixes from installed addons (for suggestions).
 */
export function collectInstalledPrefixes(addons = []) {
  const set = new Set(FALLBACK_ID_PREFIXES);
  for (const addon of addons) {
    for (const p of addon.id_prefixes || []) {
      if (p) set.add(String(p).toLowerCase());
    }
  }
  return [...set];
}
