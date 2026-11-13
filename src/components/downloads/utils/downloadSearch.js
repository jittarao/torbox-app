/**
 * @typedef {{ type: 'phrase', value: string } | { type: 'or', alternatives: string[][] }} DownloadSearchTerm
 * @typedef {{ include: DownloadSearchTerm[], exclude: DownloadSearchTerm[] }} ParsedDownloadSearch
 */

import { resolveItemFiles } from '@/utils/downloadEntityFiles';

/** Split release/file names into tokens (spaces, dots, hyphens, underscores, etc.). */
const SEARCH_TOKEN_SPLIT = /[.\-_+\s/\\[\](){}|,;:!?@#%&*='"`~]+/;

/**
 * Unquoted terms with separators (e.g. foo-bar, c++) use substring matching.
 * Plain alphanumeric terms match token prefixes (so "shan" matches "shanios" but
 * "one" does not match "alone" because it is not a leading substring of a token).
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
  if (!term) return true;
  return token === term || token.startsWith(term);
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

  const parts = word
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [word];
}

/**
 * Parse downloads search syntax:
 * - `"exact phrase"` — must contain the phrase (case-insensitive substring)
 * - `word1 word2` — any token prefix matches (OR); tokens split on . - _ space etc.
 * - `word1+word2` — every joined token prefix must match (AND)
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
    return alternatives.length
      ? /** @type {DownloadSearchTerm} */ ({ type: 'or', alternatives })
      : null;
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

const parsedSearchCache = new Map();
export const MAX_PARSED_SEARCH_CACHE = 50;

/** @param {string} query */
export function getParsedDownloadSearch(query) {
  if (parsedSearchCache.has(query)) {
    return parsedSearchCache.get(query);
  }

  const normalized = (query || '').trim().toLowerCase();
  const parsed = normalized ? parseDownloadSearchQuery(normalized) : null;

  if (parsedSearchCache.size >= MAX_PARSED_SEARCH_CACHE) {
    const firstKey = parsedSearchCache.keys().next().value;
    parsedSearchCache.delete(firstKey);
  }

  parsedSearchCache.set(query, parsed);
  return parsed;
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

/** @param {{ name?: string, files?: Array<{ name?: string, short_name?: string }> }} item @param {ParsedDownloadSearch} parsed @param {Record<string, object[]>} [filesByEntityKey] */
function collectItemSearchHaystacks(item, parsed, filesByEntityKey) {
  /** @type {string[]} */
  const haystacks = [];
  if (item.name) haystacks.push(item.name);
  for (const file of resolveItemFiles(item, filesByEntityKey)) {
    const name = file.short_name || file.name;
    if (name) haystacks.push(name);
  }
  return haystacks;
}

/** @param {{ name?: string, files?: Array<{ name?: string, short_name?: string }> }} item @param {ParsedDownloadSearch} parsed @param {Record<string, object[]>} [filesByEntityKey] */
function itemHasExcludedHaystack(item, parsed, filesByEntityKey) {
  const haystacks = collectItemSearchHaystacks(item, parsed, filesByEntityKey);
  return haystacks.some((haystack) => haystackMatchesExclude(haystack, parsed));
}

/** @param {string} query */
function isEmptyDownloadSearchQuery(query) {
  return !(query || '').trim();
}

/** True when filter/search must read file names from the side cache. */
export function downloadSearchNeedsFileCache(query) {
  return !isEmptyDownloadSearchQuery(query);
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
export function itemMatchesDownloadSearch(item, query, filesByEntityKey = null) {
  if (isEmptyDownloadSearchQuery(query)) return true;
  const parsed = getParsedDownloadSearch(query);
  if (!parsed) return true;

  if (!parsed.include.length) {
    return !itemHasExcludedHaystack(item, parsed, filesByEntityKey);
  }

  return collectItemSearchHaystacks(item, parsed, filesByEntityKey).some((haystack) =>
    haystackMatchesParsed(haystack, parsed)
  );
}

/** True when at least one file name matches (used to auto-expand). */
export function itemHasFileNameSearchMatch(item, query, filesByEntityKey = null) {
  if (isEmptyDownloadSearchQuery(query)) return false;
  const parsed = getParsedDownloadSearch(query);
  return (
    resolveItemFiles(item, filesByEntityKey).some((file) =>
      fileMatchesDownloadSearch(file, parsed)
    ) ?? false
  );
}

/** Max matching files before search skips auto-expand (avoids huge inline lists). */
export const MAX_AUTO_EXPAND_MATCHING_FILES = 15;

/**
 * Auto-expand only when file names match, the item title does not already surface
 * the hit, and the match count is small enough to browse inline.
 */
export function shouldAutoExpandItemForSearch(item, query, filesByEntityKey = null) {
  if (isEmptyDownloadSearchQuery(query)) return false;
  const parsed = getParsedDownloadSearch(query);
  const files = resolveItemFiles(item, filesByEntityKey);
  if (!parsed || !files.length) return false;
  if (itemNameMatchesDownloadSearch(item, parsed)) return false;

  const matchingFiles = files.filter((file) => fileMatchesDownloadSearch(file, parsed));
  return matchingFiles.length > 0 && matchingFiles.length <= MAX_AUTO_EXPAND_MATCHING_FILES;
}

/**
 * Files to show when an item is expanded.
 * - No query: all files
 * - File names match: matching files only
 * - Title-only match: all files
 */
export function getFilesVisibleForDownloadSearch(item, query, filesByEntityKey = null) {
  if (!item) return [];
  const files = resolveItemFiles(item, filesByEntityKey);
  if (isEmptyDownloadSearchQuery(query)) return files;

  const parsed = getParsedDownloadSearch(query);
  const matchingFiles = files.filter((file) => fileMatchesDownloadSearch(file, parsed));
  if (matchingFiles.length > 0) return matchingFiles;
  if (itemNameMatchesDownloadSearch(item, parsed)) return files;
  return matchingFiles;
}

/** True when the query has include terms to rank by (exclude-only queries do not). */
export function downloadSearchHasRankableTerms(query) {
  if (isEmptyDownloadSearchQuery(query)) return false;
  return !!getParsedDownloadSearch(query)?.include.length;
}

/**
 * Relevance, highest first: query terms found in the title, terms found only in file names,
 * every word adjacent and in query order in the title, then match quality (exact vs prefix
 * tokens, title starts with a term, share of the title the terms cover).
 * Term scores are scaled by how distinctive each loose word is among the results.
 */
const TITLE_TERM_SCORE = 100;
const FILE_ONLY_TERM_SCORE = 50;
const ADJACENT_WORDS_SCORE = 20;
const EXACTNESS_SCORE = 6;
const LEADING_MATCH_SCORE = 2;
const TITLE_COVERAGE_SCORE = 2;

/**
 * Weight floor for a loose word found in (almost) every result, e.g. "the". It still counts:
 * one extra title match (≥ 10) outweighs any quality-only difference (< 10).
 */
const MIN_COMMON_WORD_WEIGHT = 0.1;

/**
 * `explicit` terms (quoted phrases, `+`-joined words) always weigh 1; loose words are
 * weighted by rarity among the results.
 * @typedef {{ value: string, substring: boolean, explicit: boolean }} RelevanceTerm
 */

/**
 * Per-term title quality (0 = not in the title), file-only hits, and title bonuses.
 * Independent of term weights, so it is cached per item.
 * @typedef {{ title: number[], fileOnly: boolean[], leading: boolean[], adjacent: boolean, coverage: number }} RelevanceMatch
 */

/** @type {WeakMap<ParsedDownloadSearch, RelevanceTerm[]>} */
const relevanceTermsCache = new WeakMap();

/**
 * Distinct include terms in query order. Every word of an OR group counts on its own,
 * so `foo bar` ranks titles with both words above titles with one.
 * @param {ParsedDownloadSearch} parsed
 * @returns {RelevanceTerm[]}
 */
function getRelevanceTerms(parsed) {
  const cached = relevanceTermsCache.get(parsed);
  if (cached) return cached;

  /** @type {RelevanceTerm[]} */
  const terms = [];
  /** @type {Map<string, RelevanceTerm>} */
  const byValue = new Map();
  const add = (value, explicit) => {
    if (!value) return;
    const existing = byValue.get(value);
    if (existing) {
      existing.explicit ||= explicit;
      return;
    }
    const term = {
      value,
      substring: value.includes(' ') || SUBSTRING_TERM_PATTERN.test(value),
      explicit,
    };
    byValue.set(value, term);
    terms.push(term);
  };

  for (const term of parsed.include) {
    if (term.type === 'phrase') {
      add(term.value, true);
    } else {
      for (const alternative of term.alternatives) {
        for (const word of alternative) add(word, alternative.length > 1);
      }
    }
  }

  relevanceTermsCache.set(parsed, terms);
  return terms;
}

/** @param {RelevanceTerm} term @param {string} text lowercased @param {string[]} tokens */
function relevanceTermMatches(term, text, tokens) {
  if (term.substring) return text.includes(term.value);
  return tokens.some((token) => tokenMatchesSearchTerm(token, term.value));
}

/** @param {string[]} tokens @param {string[]} words */
function tokensContainAdjacentWords(tokens, words) {
  for (let start = 0; start + words.length <= tokens.length; start++) {
    let k = 0;
    while (k < words.length && tokenMatchesSearchTerm(tokens[start + k], words[k])) k++;
    if (k === words.length) return true;
  }
  return false;
}

/**
 * @param {string} title
 * @param {RelevanceTerm[]} terms
 * @param {RelevanceMatch} match filled in place
 */
function matchTitleRelevance(title, terms, match) {
  const text = (title || '').toLowerCase();
  const tokens = tokenizeSearchHaystack(text);
  const coveredTokens = new Set();

  for (let t = 0; t < terms.length; t++) {
    const term = terms[t];
    let best = 0;
    if (term.substring) {
      const index = text.indexOf(term.value);
      if (index !== -1) {
        best = 1;
        if (index === 0) match.leading[t] = true;
      }
    } else {
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (!tokenMatchesSearchTerm(token, term.value)) continue;
        coveredTokens.add(i);
        if (i === 0) match.leading[t] = true;
        // Exact token = 1; prefix scales with how much of the token the term covers.
        const quality = 0.5 + (0.5 * term.value.length) / token.length;
        if (quality > best) best = quality;
      }
    }
    match.title[t] = best;
  }

  const words = terms.filter((term) => !term.substring).map((term) => term.value);
  match.adjacent =
    words.length > 1 &&
    terms.every((term, t) => term.substring || match.title[t] > 0) &&
    tokensContainAdjacentWords(tokens, words);
  match.coverage = tokens.length ? coveredTokens.size / tokens.length : 0;
}

/**
 * @param {object} item
 * @param {RelevanceTerm[]} terms
 * @param {object[]} files
 * @returns {RelevanceMatch}
 */
function computeRelevanceMatch(item, terms, files) {
  /** @type {RelevanceMatch} */
  const match = {
    title: new Array(terms.length).fill(0),
    fileOnly: new Array(terms.length).fill(false),
    leading: new Array(terms.length).fill(false),
    adjacent: false,
    coverage: 0,
  };
  matchTitleRelevance(item.name, terms, match);

  let missing = match.title.filter((quality) => quality === 0).length;
  for (let f = 0; missing > 0 && f < files.length; f++) {
    const text = (files[f].short_name || files[f].name || '').toLowerCase();
    if (!text) continue;
    const tokens = tokenizeSearchHaystack(text);
    for (let t = 0; t < terms.length; t++) {
      if (match.title[t] > 0 || match.fileOnly[t]) continue;
      if (!relevanceTermMatches(terms[t], text, tokens)) continue;
      match.fileOnly[t] = true;
      missing--;
    }
  }

  return match;
}

/** @type {WeakMap<object, { query: string, files: object[], match: RelevanceMatch }>} */
const relevanceMatchCache = new WeakMap();

/** @returns {RelevanceMatch|null} */
function getRelevanceMatch(item, query, terms, filesByEntityKey) {
  if (!item) return null;
  const files = resolveItemFiles(item, filesByEntityKey);

  // Poll merges keep unchanged rows (and their file arrays) by reference, so re-sorts reuse matches.
  const cached = relevanceMatchCache.get(item);
  if (cached && cached.query === query && cached.files === files) return cached.match;

  const match = computeRelevanceMatch(item, terms, files);
  relevanceMatchCache.set(item, { query, files, match });
  return match;
}

/**
 * Inverse document frequency over the results, relative to the rarest loose word in the
 * query, so a query of equally common words keeps every weight at 1.
 * @param {RelevanceTerm[]} terms
 * @param {(RelevanceMatch|null)[]} matches
 */
function relevanceTermWeights(terms, matches) {
  const resultCount = matches.length;
  const idf = terms.map((term, t) => {
    if (term.explicit) return null;
    let df = 0;
    for (const match of matches) {
      if (match && (match.title[t] > 0 || match.fileOnly[t])) df++;
    }
    return df > 0 ? Math.log((resultCount + 1) / (df + 1)) : null;
  });

  const maxIdf = Math.max(0, ...idf.filter((value) => value !== null));
  return idf.map((value) =>
    value === null || maxIdf === 0 ? 1 : Math.max(MIN_COMMON_WORD_WEIGHT, value / maxIdf)
  );
}

/** @param {RelevanceMatch} match @param {number[]} weights */
function scoreRelevanceMatch(match, weights) {
  let titleWeight = 0;
  let weightedExactness = 0;
  let fileOnlyWeight = 0;
  let leadingWeight = 0;

  for (let t = 0; t < weights.length; t++) {
    const weight = weights[t];
    if (match.title[t] > 0) {
      titleWeight += weight;
      weightedExactness += weight * match.title[t];
    } else if (match.fileOnly[t]) {
      fileOnlyWeight += weight;
    }
    if (match.leading[t] && weight > leadingWeight) leadingWeight = weight;
  }

  let score = TITLE_TERM_SCORE * titleWeight + FILE_ONLY_TERM_SCORE * fileOnlyWeight;
  if (titleWeight > 0) {
    score +=
      (match.adjacent ? ADJACENT_WORDS_SCORE : 0) +
      (EXACTNESS_SCORE * weightedExactness) / titleWeight +
      LEADING_MATCH_SCORE * leadingWeight +
      TITLE_COVERAGE_SCORE * match.coverage;
  }
  return score;
}

/**
 * Relevance of each item among `items` for the query (higher is better; all 0 when the query
 * has nothing to rank). Scores depend on the whole set: loose words found in most of the
 * results weigh less. Used to sort search results; filtering still goes through
 * itemMatchesDownloadSearch.
 * @param {Array<{ name?: string, files?: Array<{ name?: string, short_name?: string }> }|null|undefined>} items
 * @param {string} query
 * @param {Record<string, object[]>} [filesByEntityKey]
 * @returns {number[]}
 */
export function scoreDownloadSearchResults(items, query, filesByEntityKey = null) {
  if (!items?.length) return [];
  if (!downloadSearchHasRankableTerms(query)) return items.map(() => 0);

  const terms = getRelevanceTerms(getParsedDownloadSearch(query));
  const matches = items.map((item) => getRelevanceMatch(item, query, terms, filesByEntityKey));
  const weights = relevanceTermWeights(terms, matches);
  return matches.map((match) => (match ? scoreRelevanceMatch(match, weights) : 0));
}
