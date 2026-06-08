/**
 * @typedef {{ type: 'phrase', value: string } | { type: 'or', alternatives: string[][] }} DownloadSearchTerm
 * @typedef {{ include: DownloadSearchTerm[], exclude: DownloadSearchTerm[] }} ParsedDownloadSearch
 */

/** Split release/file names into tokens (spaces, dots, hyphens, underscores, etc.). */
const SEARCH_TOKEN_SPLIT = /[.\-_+\s/\\[\](){}|,;:!?@#%&*='"`~]+/;

/**
 * Unquoted terms with separators (e.g. foo-bar, c++) use substring matching.
 * Plain alphanumeric terms match whole tokens only (so "one" does not match "alone").
 */
const SUBSTRING_TERM_PATTERN = /[.\-_+]/;

/**
 * @param {string} text
 * @returns {string[]}
 */
function tokenizeSearchHaystack(text) {
  return (text || '').toLowerCase().split(SEARCH_TOKEN_SPLIT).filter(Boolean);
}

/**
 * @param {string} token
 * @param {string} term
 */
function tokenMatchesSearchTerm(token, term) {
  if (token === term) return true;
  if (!token.startsWith(term)) return false;

  const suffix = token.slice(term.length);
  if (!suffix) return true;

  // disc1, ep02, 1080p — common release naming; rejects one inside alone (suffix "ne").
  return /^(\d+|[a-z]{1,2})$/i.test(suffix);
}

/**
 * @param {string} text
 * @param {string} term
 */
function textIncludesSearchTerm(text, term) {
  const haystack = (text || '').toLowerCase();
  const needle = (term || '').toLowerCase();
  if (!needle) return true;

  if (SUBSTRING_TERM_PATTERN.test(needle)) {
    return haystack.includes(needle);
  }

  return tokenizeSearchHaystack(haystack).some((token) => tokenMatchesSearchTerm(token, needle));
}

/**
 * @param {string} segment
 * @returns {string[]}
 */
function wordsFromSegment(segment) {
  const word = segment.trim().toLowerCase();
  if (!word) return [];
  if (!word.includes('+')) return [word];

  const parts = word.split('+').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [word];
}

/**
 * Parse downloads search syntax:
 * - `"exact phrase"` — must contain the phrase (case-insensitive substring)
 * - `word1 word2` — either whole word matches (OR); tokens split on . - _ space etc.
 * - `word1+word2` — both whole words must match (AND)
 * - `foo-bar` / `c++` — substring match when the term contains . - _ or +
 * - `-term` or `-"phrase"` — exclude
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
    /** @type {string[][]} */
    const alternatives = [];
    while (i < len) {
      while (i < len && /\s/.test(trimmed[i])) i += 1;
      if (i >= len) break;
      if (trimmed[i] === '"') break;
      if (trimmed[i] === '-' && alternatives.length > 0) break;

      const start = i;
      while (i < len && !/\s/.test(trimmed[i]) && trimmed[i] !== '"') i += 1;
      const segment = trimmed.slice(start, i);
      const words = wordsFromSegment(segment);
      if (words.length) alternatives.push(words);
    }
    return alternatives.length ? /** @type {DownloadSearchTerm} */ ({ type: 'or', alternatives }) : null;
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

/**
 * Multi-word phrases use substring matching; single-word phrases use whole-token rules.
 * @param {string} text
 * @param {string} phrase
 */
function phraseMatches(text, phrase) {
  const haystack = (text || '').toLowerCase();
  const value = (phrase || '').toLowerCase();
  if (!value) return true;
  if (value.includes(' ')) return haystack.includes(value);
  return textIncludesSearchTerm(haystack, value);
}

/** @param {string} text @param {string[]} words */
function alternativeMatches(text, words) {
  for (let w = 0; w < words.length; w++) {
    if (!textIncludesSearchTerm(text, words[w])) return false;
  }
  return true;
}

/** @param {string} text @param {Extract<DownloadSearchTerm, { type: 'or' }>} term */
function orTermMatches(text, term) {
  for (let a = 0; a < term.alternatives.length; a++) {
    if (alternativeMatches(text, term.alternatives[a])) return true;
  }
  return false;
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
      if (!phraseMatches(text, term.value)) return false;
    } else if (!orTermMatches(text, term)) {
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
      if (phraseMatches(text, term.value)) return true;
    } else if (orTermMatches(text, term)) {
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

/** Max matching files before search skips auto-expand (avoids huge inline lists). */
export const MAX_AUTO_EXPAND_MATCHING_FILES = 15;

/**
 * Auto-expand only when file names match, the item title does not already surface
 * the hit, and the match count is small enough to browse inline.
 */
export function shouldAutoExpandItemForSearch(item, query) {
  if (isEmptyDownloadSearchQuery(query)) return false;
  const parsed = getParsedDownloadSearch(query);
  if (!parsed || !item.files?.length) return false;
  if (itemNameMatchesDownloadSearch(item, parsed)) return false;

  const matchingFiles = item.files.filter((file) => fileMatchesDownloadSearch(file, parsed));
  return (
    matchingFiles.length > 0 && matchingFiles.length <= MAX_AUTO_EXPAND_MATCHING_FILES
  );
}

/**
 * Files to show when an item is expanded.
 * - No query: all files
 * - File names match: matching files only
 * - Title-only match: all files
 */
export function getFilesVisibleForDownloadSearch(item, query) {
  if (!item) return [];
  const files = item.files || [];
  if (isEmptyDownloadSearchQuery(query)) return files;

  const parsed = getParsedDownloadSearch(query);
  const matchingFiles = files.filter((file) => fileMatchesDownloadSearch(file, parsed));
  if (matchingFiles.length > 0) return matchingFiles;
  if (itemNameMatchesDownloadSearch(item, parsed)) return files;
  return matchingFiles;
}
