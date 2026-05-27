/** @param {string} query */
export function normalizeDownloadSearchQuery(query) {
  return (query || '').trim().toLowerCase();
}

/** @param {{ name?: string, short_name?: string }} file @param {string} normalizedQuery */
export function fileMatchesDownloadSearch(file, normalizedQuery) {
  if (!normalizedQuery) return true;
  const name = (file.short_name || file.name || '').toLowerCase();
  return name.includes(normalizedQuery);
}

/** @param {{ name?: string }} item @param {string} normalizedQuery */
export function itemNameMatchesDownloadSearch(item, normalizedQuery) {
  if (!normalizedQuery) return true;
  return (item.name || '').toLowerCase().includes(normalizedQuery);
}

/** Item row visible when title or any file name matches. */
export function itemMatchesDownloadSearch(item, query) {
  const normalizedQuery = normalizeDownloadSearchQuery(query);
  if (!normalizedQuery) return true;
  if (itemNameMatchesDownloadSearch(item, normalizedQuery)) return true;
  return item.files?.some((file) => fileMatchesDownloadSearch(file, normalizedQuery)) ?? false;
}

/** True when at least one file name matches (used to auto-expand). */
export function itemHasFileNameSearchMatch(item, query) {
  const normalizedQuery = normalizeDownloadSearchQuery(query);
  if (!normalizedQuery) return false;
  return item.files?.some((file) => fileMatchesDownloadSearch(file, normalizedQuery)) ?? false;
}

/**
 * Files to show when an item is expanded.
 * - No query: all files
 * - Item title matches: all files
 * - Only file names match: matching files only
 */
export function getFilesVisibleForDownloadSearch(item, query) {
  const files = item.files || [];
  const normalizedQuery = normalizeDownloadSearchQuery(query);
  if (!normalizedQuery || itemNameMatchesDownloadSearch(item, normalizedQuery)) {
    return files;
  }
  return files.filter((file) => fileMatchesDownloadSearch(file, normalizedQuery));
}
