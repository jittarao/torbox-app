import { create } from 'zustand';
import { EMPTY_FILTERS } from '@/components/downloads/filters/filterHelpers';

function cloneEmptyFilters() {
  return JSON.parse(JSON.stringify(EMPTY_FILTERS));
}

const initialSort = {
  sortField: 'created_at',
  sortDirection: 'desc',
};

/**
 * Downloads list UI state (filters, sort, expand).
 * Does not store filtered/sorted arrays — use downloadsDerivedSelectors.
 */
export const useDownloadsUiStore = create((set, get) => ({
  search: '',
  statusFilter: 'all',
  appliedFilters: cloneEmptyFilters(),
  ...initialSort,
  /** @type {Record<string|number, true>} */
  expandedById: {},

  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setAppliedFilters: (appliedFilters) => set({ appliedFilters }),
  setSort: (sortField, sortDirection = 'asc') => set({ sortField, sortDirection }),

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

  resetFilters: () =>
    set({
      search: '',
      statusFilter: 'all',
      appliedFilters: cloneEmptyFilters(),
    }),

  resetUi: () =>
    set({
      search: '',
      statusFilter: 'all',
      appliedFilters: cloneEmptyFilters(),
      ...initialSort,
      expandedById: {},
    }),
}));

/** @param {string|number} itemId */
export function selectIsRowExpanded(itemId) {
  return (state) => Boolean(state.expandedById[itemId]);
}

// selectFilterSortCriteria removed — the object literal pattern is unsafe without useShallow.
// Consumers should call useShallow((s) => ({...})) directly (see useDownloadsListData.js:62-70).
