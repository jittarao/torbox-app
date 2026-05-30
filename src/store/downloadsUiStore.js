import { create } from 'zustand';

/**
 * Downloads list UI state (expand/collapse only).
 * Shareable filters live in URL via useDownloadsFilterParams.
 */
export const useDownloadsUiStore = create((set, get) => ({
  /** @type {Record<string|number, true>} */
  expandedById: {},
  /** Bumped on session reset so URL filter params can be cleared. */
  filterResetNonce: 0,

  toggleExpanded: (itemId) =>
    set((state) => {
      const next = { ...state.expandedById };
      if (next[itemId]) {
        delete next[itemId];
      } else {
        next[itemId] = true;
      }
      return { expandedById: next };
    }),

  setExpanded: (itemId, expanded) =>
    set((state) => {
      const next = { ...state.expandedById };
      if (expanded) {
        next[itemId] = true;
      } else {
        delete next[itemId];
      }
      return { expandedById: next };
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

  collapseAll: () => set({ expandedById: {} }),

  resetUi: () =>
    set({
      expandedById: {},
      filterResetNonce: get().filterResetNonce + 1,
    }),
}));

/** @param {string|number} itemId */
export function selectIsRowExpanded(itemId) {
  return (state) => Boolean(state.expandedById[itemId]);
}
