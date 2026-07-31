/**
 * Classify Search page input: media ID vs free-text title lookup.
 */

/**
 * @param {string} raw
 * @returns {'empty' | 'media_id' | 'free_text'}
 */
export function classifySearchQuery(raw) {
  const q = String(raw || '').trim();
  if (!q) return 'empty';

  // IMDb movie/show or episode
  if (/^tt\d+$/i.test(q) || /^tt\d+:\d+:\d+$/i.test(q)) {
    return 'media_id';
  }

  // Prefixed id (anilist:…, tmdb:…, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9]*:.+/.test(q)) {
    return 'media_id';
  }

  return 'free_text';
}

/**
 * Build episode stream id from a title suggestion's streamId base.
 * @param {string} streamIdBase - e.g. tt0944947 or tmdb:1399
 * @param {number|string} season
 * @param {number|string} episode
 */
export function buildEpisodeStreamId(streamIdBase, season, episode) {
  const base = String(streamIdBase || '').trim();
  const s = Number(season);
  const e = Number(episode);
  if (!base || !Number.isFinite(s) || !Number.isFinite(e) || s < 0 || e < 1) {
    return null;
  }
  return `${base}:${s}:${e}`;
}

/**
 * Whether any enabled addon advertises the tmdb id prefix.
 */
export function enabledAddonsSupportTmdbPrefix(addons = []) {
  return addons.some((addon) => {
    if (!addon?.enabled) return false;
    const prefixes = Array.isArray(addon.id_prefixes) ? addon.id_prefixes : [];
    return prefixes.some((p) => String(p).toLowerCase() === 'tmdb');
  });
}

export const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w92';
export const TMDB_STILL_BASE = 'https://image.tmdb.org/t/p/w185';

/**
 * @param {string|null|undefined} posterPath
 * @returns {string|null}
 */
export function tmdbPosterUrl(posterPath) {
  if (!posterPath || typeof posterPath !== 'string') return null;
  if (posterPath.startsWith('http')) return posterPath;
  return `${TMDB_POSTER_BASE}${posterPath.startsWith('/') ? posterPath : `/${posterPath}`}`;
}

/**
 * @param {string|null|undefined} stillPath
 * @returns {string|null}
 */
export function tmdbStillUrl(stillPath) {
  if (!stillPath || typeof stillPath !== 'string') return null;
  if (stillPath.startsWith('http')) return stillPath;
  return `${TMDB_STILL_BASE}${stillPath.startsWith('/') ? stillPath : `/${stillPath}`}`;
}

/**
 * @param {string|null|undefined} airDate
 * @returns {string|null} YYYY from airDate
 */
export function yearFromAirDate(airDate) {
  if (!airDate || typeof airDate !== 'string') return null;
  return /^\d{4}/.test(airDate) ? airDate.slice(0, 4) : null;
}

/**
 * @param {number|string} seasonNumber
 * @param {number|string} episodeNumber
 * @returns {string}
 */
export function formatEpisodeCode(seasonNumber, episodeNumber) {
  const s = String(seasonNumber).padStart(2, '0');
  const e = String(episodeNumber).padStart(2, '0');
  return `S${s}E${e}`;
}

/**
 * Map TMDB mediaType to Stremio stream type list.
 * @param {string} mediaType
 * @returns {string[]|null}
 */
export function mediaTypeToStreamTypes(mediaType) {
  if (mediaType === 'movie') return ['movie'];
  if (mediaType === 'tv') return ['series'];
  return null;
}

/**
 * Bare IMDb ids that can be enriched via TMDB find.
 * Bare `tmdb:{id}` is excluded — movie/TV numeric namespaces collide without mediaType.
 * @param {string} mediaId
 */
export function isEnrichableMediaId(mediaId) {
  const id = String(mediaId || '').trim();
  return /^tt\d+$/i.test(id);
}

/**
 * Full bare IMDb id suitable for pre-submit TMDB find suggestion.
 * IMDb format: tt + 7+ digits (e.g. tt0111161, tt11126994).
 * @param {string} raw
 */
export function isFullImdbId(raw) {
  const id = String(raw || '').trim();
  return /^tt\d{7,}$/i.test(id);
}

/**
 * Build a structured Recent Searches entry from a TMDB suggestion DTO.
 * @param {object} item
 * @returns {object|null}
 */
export function suggestionToHistoryEntry(item) {
  if (!item?.streamId || (item.mediaType !== 'movie' && item.mediaType !== 'tv')) return null;
  return {
    kind: 'tmdb',
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    title: String(item.title || '').trim() || String(item.streamId),
    year: item.year || null,
    posterPath: item.posterPath || null,
    imdbId: item.imdbId || null,
    streamId: item.streamId,
  };
}

/**
 * Stable key for history list dedupe / React keys.
 * @param {{ kind?: string, tmdbId?: number, mediaType?: string, streamId?: string }|null} entry
 */
export function historyEntryKey(entry) {
  if (!entry) return '';
  if (entry.kind === 'tmdb' && entry.tmdbId != null && entry.mediaType) {
    return `tmdb:${entry.mediaType}:${entry.tmdbId}`;
  }
  return `id:${String(entry.streamId || '').toLowerCase()}`;
}

/**
 * Normalize a raw history item (v1 string or v2 object) to a history entry.
 * @param {unknown} raw
 * @returns {{ kind: string, streamId: string, [key: string]: unknown }|null}
 */
export function normalizeHistoryEntry(raw) {
  if (typeof raw === 'string') {
    const streamId = raw.trim();
    return streamId ? { kind: 'media_id', streamId } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  if (
    raw.kind === 'tmdb' &&
    raw.streamId &&
    (raw.mediaType === 'movie' || raw.mediaType === 'tv')
  ) {
    return suggestionToHistoryEntry(raw);
  }
  if (raw.streamId) return { kind: 'media_id', streamId: String(raw.streamId).trim() };
  return null;
}

/**
 * Migrate / sanitize search history array (v1 strings or v2 objects). Cap 10.
 * @param {unknown} raw
 */
export function migrateSearchHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const entry = normalizeHistoryEntry(item);
    if (!entry) continue;
    const key = historyEntryKey(entry);
    const streamKey = `id:${entry.streamId.toLowerCase()}`;
    if (seen.has(key) || seen.has(streamKey)) continue;
    seen.add(key);
    seen.add(streamKey);
    out.push(entry);
  }
  return out.slice(0, 10);
}

/**
 * Prepend a history entry, deduping by streamId / tmdb key. Cap 10.
 * @param {unknown[]} history
 * @param {unknown} entry
 * @param {{ max?: number }} [options]
 */
export function upsertSearchHistory(history, entry, { max = 10 } = {}) {
  const next = suggestionToHistoryEntry(entry) || normalizeHistoryEntry(entry);
  if (!next) return migrateSearchHistory(history);
  const key = historyEntryKey(next);
  const streamKey = `id:${next.streamId.toLowerCase()}`;
  const filtered = migrateSearchHistory(history).filter((e) => {
    const k = historyEntryKey(e);
    return k !== key && k !== streamKey && `id:${e.streamId.toLowerCase()}` !== streamKey;
  });
  return [next, ...filtered].slice(0, max);
}

/**
 * Remove one history entry by streamId / TMDB key.
 * @param {unknown[]} history
 * @param {unknown} entry
 */
export function removeSearchHistoryEntry(history, entry) {
  const target = suggestionToHistoryEntry(entry) || normalizeHistoryEntry(entry);
  if (!target) return migrateSearchHistory(history);
  const key = historyEntryKey(target);
  const streamKey = `id:${target.streamId.toLowerCase()}`;
  return migrateSearchHistory(history).filter((e) => {
    const k = historyEntryKey(e);
    return k !== key && k !== streamKey && `id:${e.streamId.toLowerCase()}` !== streamKey;
  });
}

/**
 * Build find API query params from a media id.
 * @param {string} mediaId
 * @returns {{ imdbId: string }|{ tmdbId: string }|null}
 */
export function parseFindQueryFromMediaId(mediaId) {
  const id = String(mediaId || '').trim();
  if (/^tt\d+$/i.test(id)) return { imdbId: id.toLowerCase() };
  const m = id.match(/^tmdb:(\d+)$/i);
  if (m) return { tmdbId: m[1] };
  return null;
}
