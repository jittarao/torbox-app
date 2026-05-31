/**
 * @typedef {{ type: 'phrase', value: string } | { type: 'or', words: string[] }} DownloadSearchTerm
 * @typedef {{ include: DownloadSearchTerm[], exclude: DownloadSearchTerm[] }} ParsedDownloadSearch
 */

/**
 * Parse downloads search syntax:
 * - `"exact phrase"` — must contain the phrase (case-insensitive)
 * - `word1 word2` — either word matches (OR)
 * - `-term` or `-"phrase"` — exclude (OR within unquoted groups)
 * - Multiple terms are combined with AND
 *
 * @param {string} query
 * @returns {ParsedDownloadSearch}
 */
export function parseDownloadSearchQuery(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return { include: [], exclude: [] };

  /** @type {DownloadSearchTerm[]} */
  const include = [];
  /** @type {DownloadSearchTerm[]} */
  const exclude = [];
  let i = 0;
  const len = trimmed.length;

  const readPhrase = () => {
    i += 1;
    const start = i;
    while (i < len && trimmed[i] !== '"') i += 1;
    const value = trimmed.slice(start, i).trim().toLowerCase();
    if (i < len) i += 1;
    return value ? /** @type {DownloadSearchTerm} */ ({ type: 'phrase', value }) : null;
  };

  const readOrGroup = () => {
    /** @type {string[]} */
    const words = [];
    while (i < len) {
      while (i < len && /\s/.test(trimmed[i])) i += 1;
      if (i >= len) break;
      if (trimmed[i] === '"') break;
      if (trimmed[i] === '-' && words.length > 0) break;

      const start = i;
      while (i < len && !/\s/.test(trimmed[i]) && trimmed[i] !== '"') i += 1;
      const word = trimmed.slice(start, i).toLowerCase();
      if (word) words.push(word);
    }
    return words.length ? /** @type {DownloadSearchTerm} */ ({ type: 'or', words }) : null;
  };

  while (i < len) {
    while (i < len && /\s/.test(trimmed[i])) i += 1;
    if (i >= len) break;

    /** @type {DownloadSearchTerm[]} */
    let target = include;
    if (trimmed[i] === '-' && i + 1 < len && !/\s/.test(trimmed[i + 1])) {
      target = exclude;
      i += 1;
    }

    const term = trimmed[i] === '"' ? readPhrase() : readOrGroup();
    if (term) target.push(term);
  }

  return { include, exclude };
}

/** @param {string} query */
function getParsedDownloadSearch(query) {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return null;
  return parseDownloadSearchQuery(normalized);
}

/** @param {string} haystack @param {ParsedDownloadSearch} parsed */
function haystackMatchesInclude(haystack, parsed) {
  if (!parsed.include.length) return true;

  const text = (haystack || '').toLowerCase();

  for (let t = 0; t < parsed.include.length; t++) {
    const term = parsed.include[t];
    if (term.type === 'phrase') {
      if (!text.includes(term.value)) return false;
    } else if (!term.words.some((word) => text.includes(word))) {
      return false;
    }
  }

  return true;
}

/** @param {string} haystack @param {ParsedDownloadSearch} parsed */
function haystackMatchesExclude(haystack, parsed) {
  if (!parsed.exclude.length) return false;

  const text = (haystack || '').toLowerCase();

  for (let t = 0; t < parsed.exclude.length; t++) {
    const term = parsed.exclude[t];
    if (term.type === 'phrase') {
      if (text.includes(term.value)) return true;
    } else if (term.words.some((word) => text.includes(word))) {
      return true;
    }
  }

  return false;
}

/** @param {string} haystack @param {ParsedDownloadSearch} parsed */
function haystackMatchesParsed(haystack, parsed) {
  if (!parsed.include.length && !parsed.exclude.length) return true;
  if (haystackMatchesExclude(haystack, parsed)) return false;
  return haystackMatchesInclude(haystack, parsed);
}

/** @param {{ name?: string, files?: Array<{ name?: string, short_name?: string }> }} item @param {ParsedDownloadSearch} parsed */
function collectItemSearchHaystacks(item) {
  /** @type {string[]} */
  const haystacks = [];
  if (item.name) haystacks.push(item.name);
  for (const file of item.files || []) {
    const name = file.short_name || file.name;
    if (name) haystacks.push(name);
  }
  return haystacks;
}

/** @param {{ name?: string, files?: Array<{ name?: string, short_name?: string }> }} item @param {ParsedDownloadSearch} parsed */
function itemHasExcludedHaystack(item, parsed) {
  const haystacks = collectItemSearchHaystacks(item);
  return haystacks.some((haystack) => haystackMatchesExclude(haystack, parsed));
}

/** @param {string} query */
function isEmptyDownloadSearchQuery(query) {
  return !(query || '').trim();
}

/** @param {{ name?: string, short_name?: string }} file @param {ParsedDownloadSearch | null} parsed */
function fileMatchesDownloadSearch(file, parsed) {
  if (!parsed) return true;
  const name = file.short_name || file.name || '';
  return haystackMatchesParsed(name, parsed);
}

/** @param {{ name?: string }} item @param {ParsedDownloadSearch | null} parsed */
function itemNameMatchesDownloadSearch(item, parsed) {
  if (!parsed) return true;
  return haystackMatchesParsed(item.name || '', parsed);
}

/** Item row visible when title or any file name matches the parsed query. */
export function itemMatchesDownloadSearch(item, query) {
  if (isEmptyDownloadSearchQuery(query)) return true;
  const parsed = getParsedDownloadSearch(query);
  if (!parsed) return true;

  if (!parsed.include.length) {
    return !itemHasExcludedHaystack(item, parsed);
  }

  return collectItemSearchHaystacks(item).some((haystack) => haystackMatchesParsed(haystack, parsed));
}

/** True when at least one file name matches (used to auto-expand). */
export function itemHasFileNameSearchMatch(item, query) {
  if (isEmptyDownloadSearchQuery(query)) return false;
  const parsed = getParsedDownloadSearch(query);
  return item.files?.some((file) => fileMatchesDownloadSearch(file, parsed)) ?? false;
}

/**
 * Files to show when an item is expanded.
 * - No query: all files
 * - Item title matches: all files
 * - Only file names match: matching files only
 */
export function getFilesVisibleForDownloadSearch(item, query) {
  if (!item) return [];
  const files = item.files || [];
  if (isEmptyDownloadSearchQuery(query)) return files;

  const parsed = getParsedDownloadSearch(query);
  if (itemNameMatchesDownloadSearch(item, parsed)) return files;
  return files.filter((file) => fileMatchesDownloadSearch(file, parsed));
}
