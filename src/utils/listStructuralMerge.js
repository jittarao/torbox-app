/**
 * Reuse row object references when poll/refresh data is unchanged (structural sharing).
 */

export function rowsShallowEqual(prev, next) {
  if (prev === next) return true;
  if (!prev || !next) return false;

  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;

  for (const key of prevKeys) {
    if (prev[key] !== next[key]) return false;
  }
  return true;
}

/**
 * @template T
 * @param {T[]} prevList
 * @param {T[]} nextList
 * @param {(row: T) => string|number} getId
 * @param {(prev: T, next: T) => boolean} [isEqual]
 * @returns {T[]}
 */
export function mergeListWithStructuralSharing(
  prevList,
  nextList,
  getId,
  isEqual = rowsShallowEqual
) {
  const next = nextList ?? [];
  if (!next.length) return next;
  if (!prevList?.length) return next;

  const prevById = new Map(prevList.map((row) => [getId(row), row]));
  let unchanged = prevList.length === next.length;

  const merged = next.map((row, index) => {
    const prev = prevById.get(getId(row));
    const reused = prev && isEqual(prev, row) ? prev : row;
    if (unchanged && reused !== prevList[index]) {
      unchanged = false;
    }
    return reused;
  });

  return unchanged ? prevList : merged;
}
