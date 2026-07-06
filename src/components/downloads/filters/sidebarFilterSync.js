import {
  buildTagFilter,
  buildTrackerFilter,
  getActiveTagIds,
  getActiveTrackers,
  hasActiveFilters,
} from './filterHelpers';

/** @param {string[]} a @param {string[]} b */
function sameTrackerList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((url, i) => url === sortedB[i]);
}

/** @param {number[]} a @param {number[]} b */
function sameTagIdList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const sortedA = [...a].map(Number).sort((x, y) => x - y);
  const sortedB = [...b].map(Number).sort((x, y) => x - y);
  return sortedA.every((id, i) => id === sortedB[i]);
}

/** Loose id match (API may return number or string). */
export function sameViewId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** @param {(number|string)[]} a @param {(number|string)[]} b — order-sensitive */
export function sameViewIdList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return a.every((id, i) => sameViewId(id, b[i]));
}

/**
 * Sidebar clicks update store before replaceState. Return true once the URL matches
 * the pending sidebar selection so URL→store sync can resume.
 * @param {(number|string)[]|null|undefined} urlViewIds
 * @param {object} urlAppliedFilters
 * @param {{ kind: 'view', viewIds: (number|string)[] }|{ kind: 'tag', tagIds: number[] }|{ kind: 'tracker', trackers: string[] }|{ kind: 'clear' }|null} pending
 */
export function sidebarUrlMatchesPending(urlViewIds, urlAppliedFilters, pending) {
  if (!pending) return true;
  if (pending.kind === 'view') {
    return sameViewIdList(urlViewIds ?? [], pending.viewIds);
  }
  if (pending.kind === 'tag') {
    const tagIds = getActiveTagIds(urlAppliedFilters);
    return (!urlViewIds || urlViewIds.length === 0) && sameTagIdList(tagIds, pending.tagIds);
  }
  if (pending.kind === 'tracker') {
    const trackers = getActiveTrackers(urlAppliedFilters);
    return (!urlViewIds || urlViewIds.length === 0) && sameTrackerList(trackers, pending.trackers);
  }
  if (pending.kind === 'clear') {
    return (
      (!urlViewIds || urlViewIds.length === 0) &&
      getActiveTagIds(urlAppliedFilters) == null &&
      getActiveTrackers(urlAppliedFilters) == null &&
      !hasActiveFilters(urlAppliedFilters)
    );
  }
  return false;
}

export { buildTagFilter, buildTrackerFilter };
