import { create } from 'zustand';

/**
 * Downloads list UI state (expand/collapse only).
 * Shareable filters live in URL via useDownloadsFilterParams.
 */
/** Row expand/collapse is UI-only (this store). Search/sort/filter live in URL via useDownloadsFilterParams. */
export const useDownloadsUiStore = create((set, get) => ({
  /** @type {Record<string|number, true>} */
  expandedById: {},
  /** Item ids that show all inline file rows (bypass MAX_INLINE_FILE_ROWS). */
  uncappedFileExpandById: {},
  /** Bumped on session reset so URL filter params can be cleared. */
  filterResetNonce: 0,

  toggleExpanded: (itemId) =>
    set((state) => {
      const next = { ...state.expandedById };
      const nextUncapped = { ...state.uncappedFileExpandById };
      if (next[itemId]) {
        delete next[itemId];
        delete nextUncapped[itemId];
      } else {
        next[itemId] = true;
      }
      return { expandedById: next, uncappedFileExpandById: nextUncapped };
    }),

  setExpanded: (itemId, expanded) =>
    set((state) => {
      const next = { ...state.expandedById };
      const nextUncapped = { ...state.uncappedFileExpandById };
      if (expanded) {
        next[itemId] = true;
      } else {
        delete next[itemId];
        delete nextUncapped[itemId];
      }
      return { expandedById: next, uncappedFileExpandById: nextUncapped };
    }),

  setExpandedById: (expandedById) => set({ expandedById: expandedById || {} }),

  expandIds: (itemIds) =>
    set((state) => {
      const next = { ...state.expandedById };
      for (const id of itemIds) {
        next[id] = true;
      }
      return { expandedById: next };
    }),

  collapseAll: () => set({ expandedById: {}, uncappedFileExpandById: {} }),

  uncapFilesForItem: (itemId) =>
    set((state) => ({
      expandedById: { ...state.expandedById, [itemId]: true },
      uncappedFileExpandById: { ...state.uncappedFileExpandById, [itemId]: true },
    })),

  resetUi: () =>
    set({
      expandedById: {},
      uncappedFileExpandById: {},
      filterResetNonce: get().filterResetNonce + 1,
    }),
}));

/** @param {string|number} itemId */
function selectIsRowExpanded(itemId) {
  return (state) => Boolean(state.expandedById[itemId]);
}
