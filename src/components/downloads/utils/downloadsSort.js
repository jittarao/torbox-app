import { downloadSearchHasRankableTerms } from './downloadSearch';

/**
 * Sort id for search relevance. Never written to the URL: an absent `sort`/`dir` means
 * "relevance while searching, otherwise the default sort".
 */
export const RELEVANCE_SORT_FIELD = 'relevance';

export const DEFAULT_DOWNLOADS_SORT = { sortField: 'created_at', sortDirection: 'desc' };

/**
 * Effective list sort. Searches rank by relevance unless the user picked a sort.
 * @param {{ sortField?: string|null, sortDirection?: string|null, hasExplicitSort?: boolean, search?: string }} params
 * @returns {{ sortField: string, sortDirection: 'asc'|'desc' }}
 */
export function resolveDownloadsSort({ sortField, sortDirection, hasExplicitSort, search }) {
  const wantsRelevance = !hasExplicitSort || !sortField || sortField === RELEVANCE_SORT_FIELD;
  if (wantsRelevance && downloadSearchHasRankableTerms(search)) {
    return { sortField: RELEVANCE_SORT_FIELD, sortDirection: 'desc' };
  }
  if (!sortField || sortField === RELEVANCE_SORT_FIELD) return DEFAULT_DOWNLOADS_SORT;
  return {
    sortField,
    sortDirection: sortDirection === 'asc' ? 'asc' : DEFAULT_DOWNLOADS_SORT.sortDirection,
  };
}
