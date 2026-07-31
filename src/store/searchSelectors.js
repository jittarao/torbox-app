/**
 * Client-side filter/sort for normalized Stremio stream results.
 */

import {
  getCodecMatchAliases,
  getHdrMatchAliases,
  getLanguageMatchAliases,
} from '@/components/search/searchFilterOptions';

function matchesAliases(haystack, aliases, { upper = false } = {}) {
  if (!aliases.length) return true;
  const text = upper ? String(haystack || '').toUpperCase() : String(haystack || '').toLowerCase();
  if (!text) return false;
  return aliases.some((alias) => {
    const needle = upper ? String(alias).toUpperCase() : String(alias).toLowerCase();
    return text.includes(needle);
  });
}

export function applyStreamFilters(results, filters = {}) {
  const {
    showCachedOnly = false,
    resolution = '',
    codec = '',
    hdr = '',
    language = '',
    addonId = '',
    streamTypes = [],
    minSizeBytes = null,
    maxSizeBytes = null,
  } = filters;

  const codecAliases = getCodecMatchAliases(codec);
  const hdrAliases = getHdrMatchAliases(hdr);
  const languageAliases = getLanguageMatchAliases(language);
  const typeSet = Array.isArray(streamTypes)
    ? streamTypes.map((t) => String(t).toLowerCase()).filter(Boolean)
    : [];

  return (results || []).filter((item) => {
    if (showCachedOnly && !item.cached) return false;

    if (resolution) {
      if (String(item.resolution || '').toLowerCase() !== String(resolution).toLowerCase()) {
        return false;
      }
    }

    if (codec && !matchesAliases(item.codec, codecAliases)) return false;

    if (hdr && !matchesAliases(item.hdr, hdrAliases, { upper: true })) return false;

    if (language) {
      const langHaystack = `${item.language || ''} ${item.filename || ''} ${item.title || ''} ${item.description || ''}`;
      if (!matchesAliases(langHaystack, languageAliases)) return false;
    }

    if (typeSet.length > 0) {
      const itemType = String(item.streamType || '').toLowerCase();
      if (!typeSet.includes(itemType)) return false;
    }

    if (addonId) {
      const sources = item.sources || [];
      const match = item.addonId === addonId || sources.some((s) => s.addonId === addonId);
      if (!match) return false;
    }

    if (minSizeBytes != null && Number.isFinite(minSizeBytes) && minSizeBytes > 0) {
      if (item.size == null || item.size < minSizeBytes) return false;
    }

    if (maxSizeBytes != null && Number.isFinite(maxSizeBytes) && maxSizeBytes > 0) {
      if (item.size == null || item.size >= maxSizeBytes) return false;
    }

    return true;
  });
}

export function sortStreamResults(results, sortBy = 'default', direction = 'desc') {
  if (sortBy === 'default') {
    // Already sorted by store merge; preserve order unless direction flips cached bias
    return results;
  }

  const mult = direction === 'asc' ? 1 : -1;
  return [...(results || [])].sort((a, b) => {
    if (sortBy === 'size') {
      return ((a.size ?? 0) - (b.size ?? 0)) * mult;
    }
    if (sortBy === 'title') {
      return String(a.title || '').localeCompare(String(b.title || '')) * mult;
    }
    if (sortBy === 'resolution') {
      const order = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
      return ((order[a.resolution] || 0) - (order[b.resolution] || 0)) * mult;
    }
    return 0;
  });
}

export function selectDisplayResults(results, filters, sortBy, sortDirection) {
  const filtered = applyStreamFilters(results, filters);
  return sortStreamResults(filtered, sortBy, sortDirection);
}
