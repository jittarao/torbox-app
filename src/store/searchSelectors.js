export const TORBOX_NATIVE_TRACKERS = ['Newznab'];

/**
 * Apply server-side search filters to raw results (derived, not stored).
 */
export function applySearchFilters(results, filters) {
  const {
    seasonFilter,
    episodeFilter,
    yearFilter,
    qualityFilter,
    sizeFilter,
    seedersFilter,
  } = filters;

  if (!results?.length) return [];

  let filtered = [...results];

  if (seasonFilter) {
    const s0 = seasonFilter.padStart(2, '0');
    const seasonPatterns = [
      new RegExp(`s${s0}`, 'i'),
      new RegExp(`season\\s*${seasonFilter}`, 'i'),
      new RegExp(`\\b${seasonFilter}x\\d+`, 'i'),
      new RegExp(`season\\s*${s0}`, 'i'),
    ];
    filtered = filtered.filter((item) => {
      const title = (item.raw_title || item.title || '').toLowerCase();
      return seasonPatterns.some((pattern) => pattern.test(title));
    });
  }

  if (episodeFilter) {
    const e0 = episodeFilter.padStart(2, '0');
    const episodePatterns = [
      new RegExp(`e${e0}`, 'i'),
      new RegExp(`episode\\s*${episodeFilter}`, 'i'),
      new RegExp(`\\b\\d+x${e0}`, 'i'),
      new RegExp(`episode\\s*${e0}`, 'i'),
    ];
    filtered = filtered.filter((item) => {
      const title = (item.raw_title || item.title || '').toLowerCase();
      return episodePatterns.some((pattern) => pattern.test(title));
    });
  }

  if (yearFilter) {
    filtered = filtered.filter((item) => {
      const title = item.raw_title || item.title || '';
      const titleMatch = title.includes(yearFilter);
      const parsedMatch = item.title_parsed_data?.year === yearFilter;
      return titleMatch || parsedMatch;
    });
  }

  if (qualityFilter) {
    filtered = filtered.filter((item) => {
      const title = (item.raw_title || item.title || '').toLowerCase();
      const quality = qualityFilter.toLowerCase();
      const titleMatch = title.includes(quality);
      const parsedMatch =
        item.title_parsed_data?.quality?.toLowerCase() === quality ||
        item.title_parsed_data?.resolution?.toLowerCase() === quality;
      return titleMatch || parsedMatch;
    });
  }

  if (sizeFilter) {
    const minSizeBytes = parseFloat(sizeFilter) * 1024 * 1024 * 1024;
    filtered = filtered.filter((item) => item.size >= minSizeBytes);
  }

  if (seedersFilter) {
    const minSeeders = parseInt(seedersFilter, 10);
    filtered = filtered.filter((item) => (item.last_known_seeders || 0) >= minSeeders);
  }

  return filtered;
}

export function selectSearchFilterFields(state) {
  return {
    seasonFilter: state.seasonFilter,
    episodeFilter: state.episodeFilter,
    yearFilter: state.yearFilter,
    qualityFilter: state.qualityFilter,
    sizeFilter: state.sizeFilter,
    seedersFilter: state.seedersFilter,
  };
}

export function selectFilteredResults(state) {
  return applySearchFilters(state.results, selectSearchFilterFields(state));
}

function sortSearchResults(items, sortKey, sortDir, searchType) {
  return items.toSorted((a, b) => {
    const modifier = sortDir === 'desc' ? -1 : 1;

    switch (sortKey) {
      case 'seeders': {
        if (searchType === 'usenet') return 0;
        const aValue = parseInt(a.last_known_seeders || 0, 10);
        const bValue = parseInt(b.last_known_seeders || 0, 10);
        return (aValue - bValue) * modifier;
      }
      case 'size': {
        const aValue = BigInt(a.size || 0);
        const bValue = BigInt(b.size || 0);
        return Number(aValue - bValue) * modifier;
      }
      case 'age': {
        const aValue = parseInt(String(a.age).replace('d', '') || 0, 10);
        const bValue = parseInt(String(b.age).replace('d', '') || 0, 10);
        return (aValue - bValue) * modifier;
      }
      default:
        return 0;
    }
  });
}

/**
 * Single display pipeline: store filters → sort → client UI filters.
 */
export function selectDisplayResults(state, uiPrefs) {
  const { sortKey, sortDir, showCachedOnly, hideTorBoxIndexers } = uiPrefs;
  const filtered = selectFilteredResults(state);
  const sorted = sortSearchResults(filtered, sortKey, sortDir, state.searchType);

  let display = sorted;
  if (hideTorBoxIndexers) {
    display = display.filter((t) => !TORBOX_NATIVE_TRACKERS.includes(t.tracker));
  }
  if (showCachedOnly) {
    display = display.filter((t) => t.cached);
  }

  return display;
}
