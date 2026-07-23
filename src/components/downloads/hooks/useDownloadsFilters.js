'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTranslations } from 'next-intl';
import { usePromptDialog } from '@/hooks/usePromptDialog';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useTags } from '@/components/shared/hooks/useTags';
import { filtersFromView } from '@/components/downloads/FiltersSidebar';
import {
  EMPTY_FILTERS,
  cloneFilters,
  buildTagFilter,
  buildTrackerFilter,
  buildSourceFilter,
  normalizeFilters,
  stampFilterSchemaVersion,
  mergeViewAssetTypeFilter,
  getActiveTagIds,
  getActiveTrackers,
  getActiveSources,
  getTagCombineMode,
  getTrackerCombineMode,
  getSourceCombineMode,
  isTagOnlyFilter,
  isTrackerOnlyFilter,
  isSourceOnlyFilter,
} from '@/components/downloads/filters/filterHelpers';
import {
  sameViewId,
  sameViewIdList,
  sidebarUrlMatchesPending,
} from '@/components/downloads/filters/sidebarFilterSync';
import { COMBINE_MODES } from '@/components/downloads/filters/sidebarCombineMode';
import { computeRangeSelection } from '@/components/downloads/FiltersSidebar/sidebarRangeSelect';

export function useDownloadsFilters({
  apiKey,
  isBackendAvailable,
  activeType,
  setToast,
  handleColumnChange,
  filterParams,
}) {
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const { prompt, PromptDialog } = usePromptDialog({
    cancelLabel: downloadsFiltersT('close'),
    confirmLabel: downloadsFiltersT('menuRename'),
  });
  const { updateTag: updateTagName } = useTags(apiKey);

  const {
    search: urlSearch,
    setSearch: setUrlSearch,
    statusFilter,
    setStatusFilter,
    appliedFilters: urlAppliedFilters,
    setAppliedFilters,
    patchFilterCriteria,
    clearAllFilterCriteria,
    sortField,
    sortDirection,
    setSort,
    viewIds: urlViewIds,
    viewId: urlViewId,
    viewsOp: urlViewsOp,
    tagsOp: urlTagsOp,
    trackersOp: urlTrackersOp,
    sourcesOp: urlSourcesOp,
  } = filterParams;

  const [searchInput, setSearchInput] = useState(urlSearch);
  const debouncedSearch = useDebouncedValue(searchInput, 250);

  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (debouncedSearch !== urlSearch) {
      setUrlSearch(debouncedSearch);
    }
  }, [debouncedSearch, urlSearch, setUrlSearch]);

  const setSearch = useCallback((value) => {
    setSearchInput(value);
  }, []);

  const [columnFilters, setColumnFilters] = useState(() => cloneFilters(EMPTY_FILTERS));
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterModalMode, setFilterModalMode] = useState(null);
  const [editingView, setEditingView] = useState(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const {
    views,
    activeView,
    applyView,
    clearView,
    loadViews,
    updateView,
    loading: viewsLoading,
    hasLoaded: viewsHasLoaded,
    reorderViews,
  } = useCustomViews(apiKey);

  const activeViewIds = useMemo(() => urlViewIds ?? [], [urlViewIds]);

  const activeViews = useMemo(() => {
    if (!activeViewIds.length || !views?.length) return [];
    return activeViewIds.flatMap((id) => {
      const view = views.find((v) => sameViewId(v.id, id));
      return view ? [view] : [];
    });
  }, [activeViewIds, views]);

  const orViewFilters = activeViews.length > 1 ? activeViews : null;

  const appliedFilters = useMemo(() => {
    if (activeViews.length === 1) {
      const view = activeViews[0];
      return mergeViewAssetTypeFilter(view.filters, view.asset_type);
    }
    if (activeViews.length > 1) {
      return cloneFilters(EMPTY_FILTERS);
    }
    if (activeView) {
      return mergeViewAssetTypeFilter(activeView.filters, activeView.asset_type);
    }
    return urlAppliedFilters;
  }, [activeViews, activeView, urlAppliedFilters]);

  const activeTagIds = getActiveTagIds(appliedFilters) ?? [];
  const activeTrackers = getActiveTrackers(appliedFilters) ?? [];
  const activeSources = getActiveSources(appliedFilters) ?? [];

  const viewCombineMode =
    activeViewIds.length > 1 ? (urlViewsOp ?? COMBINE_MODES.ANY) : COMBINE_MODES.ANY;
  const tagCombineMode = getTagCombineMode(appliedFilters);
  const trackerCombineMode = getTrackerCombineMode(appliedFilters);
  const sourceCombineMode = getSourceCombineMode(appliedFilters);

  const filterDepsRef = useRef({
    filterModalMode,
    editingView,
    activeType,
    search: searchInput,
    sortField,
    sortDirection,
  });
  useEffect(() => {
    filterDepsRef.current = {
      filterModalMode,
      editingView,
      activeType,
      search: searchInput,
      sortField,
      sortDirection,
    };
  }, [filterModalMode, editingView, activeType, searchInput, sortField, sortDirection]);

  /** Prevents URL ?view= from re-applying after the user clears the active view. */
  const suppressUrlViewSyncRef = useRef(false);
  const lastSyncedUrlViewIdsRef = useRef([]);
  /** @type {import('react').MutableRefObject<{ kind: string, viewIds?: (number|string)[], tagIds?: number[], trackers?: string[] }|null>} */
  const pendingSidebarFilterRef = useRef(null);
  const viewsRef = useRef(views);

  useEffect(() => {
    viewsRef.current = views;
  }, [views]);

  useEffect(() => {
    if (isBackendAvailable && apiKey && !viewsHasLoaded && !viewsLoading) {
      loadViews();
    }
  }, [apiKey, isBackendAvailable, viewsHasLoaded, viewsLoading, loadViews]);

  const handleClearFilters = useCallback(() => {
    pendingSidebarFilterRef.current = { kind: 'clear' };
    suppressUrlViewSyncRef.current = true;
    lastSyncedUrlViewIdsRef.current = urlViewIds ?? [];
    clearView();
    const empty = cloneFilters(EMPTY_FILTERS);
    setColumnFilters(empty);
    clearAllFilterCriteria();
  }, [clearView, clearAllFilterCriteria, urlViewIds]);

  const applyViewPreset = useCallback(
    (view) => {
      let visibleColumns = view.visible_columns;
      if (visibleColumns) {
        if (typeof visibleColumns === 'string') {
          try {
            visibleColumns = JSON.parse(visibleColumns);
          } catch (e) {
            console.error('Error parsing visible columns:', e);
            visibleColumns = null;
          }
        }
        if (Array.isArray(visibleColumns) && visibleColumns.length > 0) {
          handleColumnChange?.(visibleColumns);
        }
      }
    },
    [handleColumnChange]
  );

  const applyViewFilters = useCallback(
    (view, { fromUrlSync = false } = {}) => {
      if (!fromUrlSync) {
        pendingSidebarFilterRef.current = { kind: 'view', viewIds: [view.id] };
        suppressUrlViewSyncRef.current = true;
      }

      applyView(view);

      const normalizedFilters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
      setColumnFilters(normalizedFilters);

      const criteriaPatch = {
        statusFilter: 'all',
        viewIds: [view.id],
        tagIds: null,
        trackerUrls: null,
        sourceHosts: null,
        search: view.search_query || '',
      };
      if (view.sort_field) {
        criteriaPatch.sortField = view.sort_field;
        criteriaPatch.sortDirection = view.sort_direction || 'desc';
      }
      patchFilterCriteria(criteriaPatch);
      lastSyncedUrlViewIdsRef.current = [view.id];

      applyViewPreset(view);
      setMobileFiltersOpen(false);
    },
    [applyView, patchFilterCriteria, applyViewPreset]
  );

  const applyMultiViewFilters = useCallback(
    (
      viewIds,
      { fromUrlSync = false, reapplyPreset = false, combineMode = COMBINE_MODES.ANY } = {}
    ) => {
      const resolved = viewIds.flatMap((id) => {
        const view = viewsRef.current.find((v) => sameViewId(v.id, id));
        return view ? [view] : [];
      });
      if (resolved.length === 0) return;

      const first = resolved[0];

      if (!fromUrlSync) {
        pendingSidebarFilterRef.current = { kind: 'view', viewIds };
        suppressUrlViewSyncRef.current = true;
      }

      applyView(first);
      setColumnFilters(cloneFilters(EMPTY_FILTERS));

      const criteriaPatch = {
        statusFilter: 'all',
        viewIds,
        tagIds: null,
        trackerUrls: null,
        sourceHosts: null,
      };
      if (viewIds.length > 1) {
        criteriaPatch.viewsOp = combineMode;
      }
      if (reapplyPreset) {
        criteriaPatch.search = first.search_query || '';
        if (first.sort_field) {
          criteriaPatch.sortField = first.sort_field;
          criteriaPatch.sortDirection = first.sort_direction || 'desc';
        }
      }
      patchFilterCriteria(criteriaPatch);
      lastSyncedUrlViewIdsRef.current = viewIds;

      if (reapplyPreset) {
        applyViewPreset(first);
      }

      setMobileFiltersOpen(false);
    },
    [applyView, patchFilterCriteria, applyViewPreset]
  );

  const applyViewFiltersRef = useRef(applyViewFilters);
  const applyMultiViewFiltersRef = useRef(applyMultiViewFilters);

  useEffect(() => {
    applyViewFiltersRef.current = applyViewFilters;
    applyMultiViewFiltersRef.current = applyMultiViewFilters;
  }, [applyViewFilters, applyMultiViewFilters]);

  // Sync store from URL when ?view= / ?views= changes (e.g. shared link). Sidebar clicks set
  // pendingSidebarFilterRef until replaceState catches up — do not re-apply a stale selection.
  useEffect(() => {
    const pending = pendingSidebarFilterRef.current;
    if (pending && !sidebarUrlMatchesPending(urlViewIds, urlAppliedFilters, pending)) {
      return;
    }
    if (pending) {
      pendingSidebarFilterRef.current = null;
      suppressUrlViewSyncRef.current = false;
    }

    if (!urlViewIds?.length) {
      lastSyncedUrlViewIdsRef.current = [];
      return;
    }
    if (!viewsHasLoaded || !viewsRef.current?.length) return;
    if (suppressUrlViewSyncRef.current) return;
    if (sameViewIdList(lastSyncedUrlViewIdsRef.current, urlViewIds)) return;

    const resolved = urlViewIds.flatMap((id) => {
      const view = viewsRef.current.find((v) => sameViewId(v.id, id));
      return view ? [view] : [];
    });
    if (resolved.length === 0) return;

    lastSyncedUrlViewIdsRef.current = urlViewIds;

    if (resolved.length === 1) {
      const storeActiveViewId = useCustomViewsStore.getState().activeView?.id;
      if (sameViewId(storeActiveViewId, resolved[0].id)) return;
      applyViewFiltersRef.current(resolved[0], { fromUrlSync: true });
      return;
    }

    applyMultiViewFiltersRef.current(urlViewIds, {
      fromUrlSync: true,
      reapplyPreset: true,
      combineMode: urlViewsOp ?? COMBINE_MODES.ANY,
    });
  }, [urlViewIds, urlAppliedFilters, viewsHasLoaded, urlViewsOp]);

  const commitViewIds = useCallback(
    (next, previousIds, combineMode = viewCombineMode) => {
      if (next.length === 0) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }

      if (next.length === 1) {
        const single = views.find((v) => sameViewId(v.id, next[0]));
        if (single) applyViewFilters(single);
        return;
      }

      const firstChanged = !sameViewId(next[0], previousIds[0]);
      applyMultiViewFilters(next, { reapplyPreset: firstChanged, combineMode });
    },
    [views, handleClearFilters, applyViewFilters, applyMultiViewFilters, viewCombineMode]
  );

  const handleApplyView = useCallback(
    (view) => {
      const current = activeViewIds;
      const isActive = current.some((id) => sameViewId(id, view.id));
      const next = isActive
        ? current.filter((id) => !sameViewId(id, view.id))
        : [...current, view.id];
      commitViewIds(next, current);
    },
    [activeViewIds, commitViewIds]
  );

  const handleApplyViewRange = useCallback(
    (viewIds, activate) => {
      const current = activeViewIds;
      const next = computeRangeSelection(current, viewIds, activate, String);
      commitViewIds(next, current);
    },
    [activeViewIds, commitViewIds]
  );

  const handleClearViews = useCallback(() => {
    if (activeViewIds.length === 0) return;
    handleClearFilters();
    setMobileFiltersOpen(false);
  }, [activeViewIds.length, handleClearFilters]);

  const commitTagIds = useCallback(
    (next, combineMode = tagCombineMode) => {
      if (activeView) return;

      if (next.length === 0) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }

      pendingSidebarFilterRef.current = { kind: 'tag', tagIds: next };
      suppressUrlViewSyncRef.current = true;
      lastSyncedUrlViewIdsRef.current = [];

      clearView();
      const tagFilter = buildTagFilter(next, { combineMode });
      setColumnFilters(tagFilter);
      patchFilterCriteria({
        statusFilter: 'all',
        search: '',
        viewIds: null,
        tagIds: next,
        tagsOp: next.length > 1 ? combineMode : COMBINE_MODES.ANY,
        trackerUrls: null,
        sourceHosts: null,
      });
      setMobileFiltersOpen(false);
    },
    [activeView, handleClearFilters, clearView, patchFilterCriteria, tagCombineMode]
  );

  const handleApplyTag = useCallback(
    (tagId) => {
      if (activeView) return;

      const id = Number(tagId);
      const current = getActiveTagIds(appliedFilters) ?? [];
      const isActive = current.includes(id);
      const next = isActive ? current.filter((t) => t !== id) : [...current, id];
      commitTagIds(next);
    },
    [appliedFilters, activeView, commitTagIds]
  );

  const handleApplyTagRange = useCallback(
    (tagIds, activate) => {
      if (activeView) return;

      const current = getActiveTagIds(appliedFilters) ?? [];
      const next = computeRangeSelection(current, tagIds, activate, Number);
      commitTagIds(next);
    },
    [appliedFilters, activeView, commitTagIds]
  );

  const handleClearTags = useCallback(() => {
    if (!isTagOnlyFilter(appliedFilters) && activeTagIds.length === 0) return;
    handleClearFilters();
    setMobileFiltersOpen(false);
  }, [appliedFilters, activeTagIds.length, handleClearFilters]);

  const commitTrackerUrls = useCallback(
    (next, combineMode = trackerCombineMode) => {
      if (next.length === 0) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }

      pendingSidebarFilterRef.current = { kind: 'tracker', trackers: next };
      suppressUrlViewSyncRef.current = true;
      lastSyncedUrlViewIdsRef.current = [];

      clearView();
      const trackerFilter = buildTrackerFilter(next, { combineMode });
      setColumnFilters(trackerFilter);
      patchFilterCriteria({
        statusFilter: 'all',
        search: '',
        viewIds: null,
        tagIds: null,
        trackerUrls: next,
        trackersOp: next.length > 1 ? combineMode : COMBINE_MODES.ANY,
        sourceHosts: null,
      });
      setMobileFiltersOpen(false);
    },
    [handleClearFilters, clearView, patchFilterCriteria, trackerCombineMode]
  );

  const handleApplyTracker = useCallback(
    (trackerUrl) => {
      const url = String(trackerUrl);
      const current = getActiveTrackers(appliedFilters) ?? [];
      const isActive = current.includes(url);
      const next = isActive ? current.filter((t) => t !== url) : [...current, url];
      commitTrackerUrls(next);
    },
    [appliedFilters, commitTrackerUrls]
  );

  const handleApplyTrackerRange = useCallback(
    (trackerUrls, activate) => {
      const current = getActiveTrackers(appliedFilters) ?? [];
      const next = computeRangeSelection(current, trackerUrls, activate, String);
      commitTrackerUrls(next);
    },
    [appliedFilters, commitTrackerUrls]
  );

  const handleClearTrackers = useCallback(() => {
    if (!isTrackerOnlyFilter(appliedFilters) && activeTrackers.length === 0) return;
    handleClearFilters();
    setMobileFiltersOpen(false);
  }, [appliedFilters, activeTrackers.length, handleClearFilters]);

  const commitSourceHosts = useCallback(
    (next, combineMode = sourceCombineMode) => {
      if (next.length === 0) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }

      pendingSidebarFilterRef.current = { kind: 'source', sources: next };
      suppressUrlViewSyncRef.current = true;
      lastSyncedUrlViewIdsRef.current = [];

      clearView();
      const sourceFilter = buildSourceFilter(next, { combineMode });
      setColumnFilters(sourceFilter);
      patchFilterCriteria({
        statusFilter: 'all',
        search: '',
        viewIds: null,
        tagIds: null,
        trackerUrls: null,
        sourceHosts: next,
        sourcesOp: next.length > 1 ? combineMode : COMBINE_MODES.ANY,
      });
      setMobileFiltersOpen(false);
    },
    [handleClearFilters, clearView, patchFilterCriteria, sourceCombineMode]
  );

  const handleApplySource = useCallback(
    (sourceHost) => {
      const host = String(sourceHost);
      const current = getActiveSources(appliedFilters) ?? [];
      const isActive = current.includes(host);
      const next = isActive ? current.filter((s) => s !== host) : [...current, host];
      commitSourceHosts(next);
    },
    [appliedFilters, commitSourceHosts]
  );

  const handleApplySourceRange = useCallback(
    (sourceHosts, activate) => {
      const current = getActiveSources(appliedFilters) ?? [];
      const next = computeRangeSelection(current, sourceHosts, activate, String);
      commitSourceHosts(next);
    },
    [appliedFilters, commitSourceHosts]
  );

  const handleClearSources = useCallback(() => {
    if (!isSourceOnlyFilter(appliedFilters) && activeSources.length === 0) return;
    handleClearFilters();
    setMobileFiltersOpen(false);
  }, [appliedFilters, activeSources.length, handleClearFilters]);

  useEffect(() => {
    if (activeType === 'all' || activeType === 'torrents') return;
    const trackers = getActiveTrackers(urlAppliedFilters);
    if (!trackers) return;

    pendingSidebarFilterRef.current = { kind: 'clear' };
    suppressUrlViewSyncRef.current = true;
    const empty = cloneFilters(EMPTY_FILTERS);
    setColumnFilters(empty);
    patchFilterCriteria({
      trackerUrls: null,
      sourceHosts: null,
      appliedFilters: empty,
      viewIds: null,
      tagIds: null,
    });
  }, [activeType, urlAppliedFilters, patchFilterCriteria]);

  useEffect(() => {
    if (activeType === 'all' || activeType === 'webdl') return;
    const sources = getActiveSources(urlAppliedFilters);
    if (!sources) return;

    pendingSidebarFilterRef.current = { kind: 'clear' };
    suppressUrlViewSyncRef.current = true;
    const empty = cloneFilters(EMPTY_FILTERS);
    setColumnFilters(empty);
    patchFilterCriteria({
      sourceHosts: null,
      appliedFilters: empty,
      viewIds: null,
      tagIds: null,
    });
  }, [activeType, urlAppliedFilters, patchFilterCriteria]);

  const handleCloseFilterModal = useCallback(() => {
    setFilterModalOpen(false);
    setFilterModalMode(null);
    setEditingView(null);
  }, []);

  const handleEditView = (view) => {
    setEditingView(view);
    setColumnFilters(filtersFromView(view));
    setFilterModalMode('edit');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleViewCreated = (view) => {
    applyViewFilters(view);
    setToast({
      message: downloadsFiltersT('viewCreated', { name: view.name }),
      type: 'success',
    });
  };

  const handleViewUpdated = (view) => {
    if (activeViewIds.some((id) => sameViewId(id, view.id))) {
      if (activeViewIds.length === 1) {
        applyViewFilters(view);
      } else if (sameViewId(activeViewIds[0], view.id)) {
        applyMultiViewFilters(activeViewIds, { reapplyPreset: true });
      }
    }
    setToast({
      message: downloadsFiltersT('viewUpdated', { name: view.name }),
      type: 'success',
    });
  };

  const handleRenameView = async (view) => {
    const newName = await prompt('Rename view:', view.name);
    if (!newName?.trim() || newName.trim() === view.name) return;
    try {
      await updateView(view.id, { name: newName.trim() });
    } catch (error) {
      setToast({ message: `Failed to rename view: ${error.message}`, type: 'error' });
    }
  };

  const handleRenameTag = async (tag) => {
    const newName = await prompt('Rename tag:', tag.name);
    if (!newName?.trim() || newName.trim() === tag.name) return;
    try {
      await updateTagName(tag.id, newName.trim());
    } catch (error) {
      setToast({ message: `Failed to rename tag: ${error.message}`, type: 'error' });
    }
  };

  const handleTagDeleted = (tagId) => {
    if (activeTagIds.includes(Number(tagId))) {
      const next = activeTagIds.filter((id) => id !== Number(tagId));
      if (next.length === 0) {
        handleClearFilters();
        return;
      }
      pendingSidebarFilterRef.current = { kind: 'tag', tagIds: next };
      suppressUrlViewSyncRef.current = true;
      const tagFilter = buildTagFilter(next, { combineMode: tagCombineMode });
      setColumnFilters(tagFilter);
      patchFilterCriteria({
        statusFilter: 'all',
        search: '',
        viewIds: null,
        tagIds: next,
        tagsOp: next.length > 1 ? tagCombineMode : COMBINE_MODES.ANY,
        trackerUrls: null,
        sourceHosts: null,
      });
    }
  };

  const handleSetViewCombineMode = useCallback(
    (mode) => {
      if (activeViewIds.length < 2) return;
      pendingSidebarFilterRef.current = { kind: 'view', viewIds: activeViewIds };
      suppressUrlViewSyncRef.current = true;
      patchFilterCriteria({ viewsOp: mode });
    },
    [activeViewIds, patchFilterCriteria]
  );

  const handleSetTagCombineMode = useCallback(
    (mode) => {
      const current = getActiveTagIds(appliedFilters) ?? [];
      if (current.length < 2 || activeView) return;
      commitTagIds(current, mode);
    },
    [appliedFilters, activeView, commitTagIds]
  );

  const handleSetTrackerCombineMode = useCallback(
    (mode) => {
      const current = getActiveTrackers(appliedFilters) ?? [];
      if (current.length < 2) return;
      commitTrackerUrls(current, mode);
    },
    [appliedFilters, commitTrackerUrls]
  );

  const handleSetSourceCombineMode = useCallback(
    (mode) => {
      const current = getActiveSources(appliedFilters) ?? [];
      if (current.length < 2) return;
      commitSourceHosts(current, mode);
    },
    [appliedFilters, commitSourceHosts]
  );

  const handleOpenNewFilter = () => {
    setEditingView(null);
    const sourceFilters = activeView ? filtersFromView(activeView) : appliedFilters;
    setColumnFilters(normalizeFilters(sourceFilters));
    setFilterModalMode('filter');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleEditActiveFilters = () => {
    if (activeView) {
      handleEditView(activeView);
      return;
    }
    handleOpenNewFilter();
  };

  const handleOpenNewView = () => {
    clearView();
    setEditingView(null);
    setColumnFilters(cloneFilters(EMPTY_FILTERS));
    setFilterModalMode('create');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenTagManager = () => {
    setTagManagerOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleApplyFiltersFromModal = (filters) => {
    const stamped = stampFilterSchemaVersion(filters);
    setColumnFilters(stamped);
    setAppliedFilters(stamped);
  };

  const handlePreviewFiltersFromModal = useCallback(
    (filters, { includeSort = false, includeSearch = false } = {}) => {
      const { search, sortField, sortDirection } = filterDepsRef.current;
      const stamped = stampFilterSchemaVersion(filters);
      setColumnFilters(stamped);
      clearView();

      const criteriaPatch = {
        statusFilter: 'all',
        viewIds: null,
        tagIds: null,
        trackerUrls: null,
        sourceHosts: null,
        appliedFilters: stamped,
        search: includeSearch && search?.trim() ? search.trim() : '',
      };
      if (includeSort && sortField) {
        criteriaPatch.sortField = sortField;
        criteriaPatch.sortDirection = sortDirection || 'desc';
      }
      patchFilterCriteria(criteriaPatch);
    },
    [clearView, patchFilterCriteria]
  );

  const handleSort = useCallback(
    (field) => {
      if (sortField === field) {
        setSort(field, sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSort(field, 'asc');
      }
    },
    [sortField, sortDirection, setSort]
  );

  const handleReorderViews = useCallback(
    async (orderedIds) => {
      try {
        await reorderViews(orderedIds);
      } catch (error) {
        setToast({
          message: downloadsFiltersT('reorderViewsFailed', { error: error.message }),
          type: 'error',
        });
        throw error;
      }
    },
    [reorderViews, setToast, downloadsFiltersT]
  );

  return {
    columnFilters,
    setColumnFilters,
    appliedFilters,
    setAppliedFilters,
    filterModalOpen,
    setFilterModalOpen,
    filterModalMode,
    setFilterModalMode,
    editingView,
    setEditingView,
    tagManagerOpen,
    setTagManagerOpen,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    search: searchInput,
    debouncedSearch,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    handleSort,
    setSort,
    views,
    activeView,
    activeViewIds,
    activeViews,
    orViewFilters,
    viewCombineMode,
    tagCombineMode,
    trackerCombineMode,
    sourceCombineMode,
    applyView,
    clearView,
    viewsLoading,
    activeTagIds,
    activeTrackers,
    activeSources,
    handleApplyView,
    handleApplyViewRange,
    handleClearViews,
    handleClearFilters,
    handleClearView: handleClearFilters,
    handleApplyTag,
    handleApplyTagRange,
    handleClearTags,
    handleApplyTracker,
    handleApplyTrackerRange,
    handleClearTrackers,
    handleApplySource,
    handleApplySourceRange,
    handleClearSources,
    handleSetViewCombineMode,
    handleSetTagCombineMode,
    handleSetTrackerCombineMode,
    handleSetSourceCombineMode,
    handleCloseFilterModal,
    handleEditView,
    handleViewCreated,
    handleViewUpdated,
    handleRenameView,
    handleRenameTag,
    handleTagDeleted,
    handleOpenNewFilter,
    handleEditActiveFilters,
    handleOpenNewView,
    handleOpenTagManager,
    handleApplyFiltersFromModal,
    handlePreviewFiltersFromModal,
    handleReorderViews,
    PromptDialog,
  };
}
