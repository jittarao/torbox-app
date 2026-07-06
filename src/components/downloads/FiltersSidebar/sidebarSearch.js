/**
 * Case-insensitive substring match for sidebar unified search.
 * @param {string} query
 * @param {...(string|null|undefined)} haystacks
 */
export function matchesSidebarSearch(query, ...haystacks) {
  const normalized = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return haystacks.some((value) =>
    String(value ?? '')
      .toLowerCase()
      .includes(normalized)
  );
}
