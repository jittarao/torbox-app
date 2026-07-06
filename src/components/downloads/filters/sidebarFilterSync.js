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

/** Loose id match (API may return number or string). */
export function sameViewId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/**
 * Sidebar clicks update store before replaceState. Return true once the URL matches
 * the pending sidebar selection so URL→store sync can resume.
 * @param {number|string|null} urlViewId
 * @param {object} urlAppliedFilters
 * @param {{ kind: 'view', viewId: number|string }|{ kind: 'tag', tagId: number }|{ kind: 'tracker', trackers: string[] }|{ kind: 'clear' }|null} pending
 */
export function sidebarUrlMatchesPending(urlViewId, urlAppliedFilters, pending) {
  if (!pending) return true;
  if (pending.kind === 'view') {
    return sameViewId(urlViewId, pending.viewId);
  }
  if (pending.kind === 'tag') {
    const tagIds = getActiveTagIds(urlAppliedFilters);
    return urlViewId == null && tagIds?.length === 1 && tagIds[0] === pending.tagId;
  }
  if (pending.kind === 'tracker') {
    const trackers = getActiveTrackers(urlAppliedFilters);
    return urlViewId == null && sameTrackerList(trackers, pending.trackers);
  }
  if (pending.kind === 'clear') {
    return (
      urlViewId == null &&
      getActiveTagIds(urlAppliedFilters) == null &&
      getActiveTrackers(urlAppliedFilters) == null &&
      !hasActiveFilters(urlAppliedFilters)
    );
  }
  return false;
}

export { buildTagFilter, buildTrackerFilter };
