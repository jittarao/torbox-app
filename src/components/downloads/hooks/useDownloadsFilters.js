'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useCustomViewsStore } from '@/store/customViewsStore';
import { useTags } from '@/components/shared/hooks/useTags';
import { filtersFromView } from '@/components/downloads/FiltersSidebar';
import {
  EMPTY_FILTERS,
  buildTagFilter,
  normalizeFilters,
  mergeViewAssetTypeFilter,
  getActiveTagIds,
} from '@/components/downloads/filters/filterHelpers';
import {
  sameViewId,
  sidebarUrlMatchesPending,
} from '@/components/downloads/filters/sidebarFilterSync';

export function useDownloadsFilters({
  apiKey,
  isBackendAvailable,
  activeType,
  setToast,
  handleColumnChange,
  filterParams,
}) {
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const { updateTag: updateTagName } = useTags(apiKey);

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    appliedFilters: urlAppliedFilters,
    setAppliedFilters,
    patchFilterCriteria,
    clearAllFilterCriteria,
    sortField,
    sortDirection,
    setSort,
    viewId: urlViewId,
  } = filterParams;

  const [columnFilters, setColumnFilters] = useState(() =>
    JSON.parse(JSON.stringify(EMPTY_FILTERS))
  );
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
  } = useCustomViews(apiKey);

  const appliedFilters = useMemo(() => {
    if (activeView) {
      return mergeViewAssetTypeFilter(activeView.filters, activeView.asset_type);
    }
    return urlAppliedFilters;
  }, [activeView, urlAppliedFilters]);

  const activeTagIds = getActiveTagIds(appliedFilters);

  const filterDepsRef = useRef({
    filterModalMode,
    editingView,
    activeType,
    search,
    sortField,
    sortDirection,
  });
  filterDepsRef.current = {
    filterModalMode,
    editingView,
    activeType,
    search,
    sortField,
    sortDirection,
  };

  /** Prevents URL ?view= from re-applying after the user clears the active view. */
  const suppressUrlViewSyncRef = useRef(false);
  const lastSyncedUrlViewIdRef = useRef(null);
  /** @type {import('react').MutableRefObject<{ kind: string, viewId?: number|string, tagId?: number }|null>} */
  const pendingSidebarFilterRef = useRef(null);
  const viewsRef = useRef(views);
  viewsRef.current = views;

  useEffect(() => {
    if (isBackendAvailable && apiKey && !viewsHasLoaded && !viewsLoading) {
      loadViews();
    }
  }, [apiKey, isBackendAvailable, viewsHasLoaded, viewsLoading, loadViews]);

  const handleClearFilters = useCallback(() => {
    pendingSidebarFilterRef.current = { kind: 'clear' };
    suppressUrlViewSyncRef.current = true;
    lastSyncedUrlViewIdRef.current = urlViewId ?? null;
    clearView();
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    clearAllFilterCriteria();
  }, [clearView, clearAllFilterCriteria, urlViewId]);

  const applyViewFilters = useCallback(
    (view, { fromUrlSync = false } = {}) => {
      if (!fromUrlSync) {
        pendingSidebarFilterRef.current = { kind: 'view', viewId: view.id };
        suppressUrlViewSyncRef.current = true;
      }

      applyView(view);

      const normalizedFilters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
      setColumnFilters(normalizedFilters);

      const criteriaPatch = {
        statusFilter: 'all',
        viewId: view.id,
        tagIds: null,
        search: view.search_query || '',
      };
      if (view.sort_field) {
        criteriaPatch.sortField = view.sort_field;
        criteriaPatch.sortDirection = view.sort_direction || 'desc';
      }
      patchFilterCriteria(criteriaPatch);
      lastSyncedUrlViewIdRef.current = view.id;

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

      setMobileFiltersOpen(false);

      return visibleColumns;
    },
    [applyView, patchFilterCriteria, handleColumnChange]
  );

  const applyViewFiltersRef = useRef(applyViewFilters);
  applyViewFiltersRef.current = applyViewFilters;

  // Sync store from URL when ?view= changes (e.g. shared link). Sidebar clicks set
  // pendingSidebarFilterRef until replaceState catches up — do not re-apply a stale ?view=.
  useEffect(() => {
    const pending = pendingSidebarFilterRef.current;
    if (pending && !sidebarUrlMatchesPending(urlViewId, urlAppliedFilters, pending)) {
      return;
    }
    if (pending) {
      pendingSidebarFilterRef.current = null;
      suppressUrlViewSyncRef.current = false;
    }

    if (urlViewId == null) {
      lastSyncedUrlViewIdRef.current = null;
      return;
    }
    if (!viewsHasLoaded || !viewsRef.current?.length) return;
    if (suppressUrlViewSyncRef.current) return;
    if (
      lastSyncedUrlViewIdRef.current != null &&
      sameViewId(lastSyncedUrlViewIdRef.current, urlViewId)
    ) {
      return;
    }

    const view = viewsRef.current.find((v) => sameViewId(v.id, urlViewId));
    if (!view) return;

    lastSyncedUrlViewIdRef.current = urlViewId;
    const storeActiveViewId = useCustomViewsStore.getState().activeView?.id;
    if (sameViewId(storeActiveViewId, view.id)) return;

    applyViewFiltersRef.current(view, { fromUrlSync: true });
  }, [urlViewId, urlAppliedFilters, viewsHasLoaded]);

  const handleApplyView = useCallback(
    (view) => {
      if (sameViewId(activeView?.id, view.id)) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }
      return applyViewFilters(view);
    },
    [activeView?.id, handleClearFilters, applyViewFilters]
  );

  const handleApplyTag = useCallback(
    (tagId) => {
      const id = Number(tagId);
      const isActive = activeTagIds?.length === 1 && activeTagIds[0] === id && !activeView;

      if (isActive) {
        handleClearFilters();
        setMobileFiltersOpen(false);
        return;
      }

      pendingSidebarFilterRef.current = { kind: 'tag', tagId: id };
      suppressUrlViewSyncRef.current = true;
      lastSyncedUrlViewIdRef.current = null;

      clearView();
      const tagFilter = buildTagFilter(id);
      setColumnFilters(tagFilter);
      patchFilterCriteria({
        statusFilter: 'all',
        search: '',
        viewId: null,
        tagIds: [id],
      });
      setMobileFiltersOpen(false);
    },
    [activeTagIds, activeView, handleClearFilters, clearView, patchFilterCriteria]
  );

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
    if (activeView?.id === view.id) {
      applyViewFilters(view);
    }
    setToast({
      message: downloadsFiltersT('viewUpdated', { name: view.name }),
      type: 'success',
    });
  };

  const handleRenameView = async (view) => {
    const newName = window.prompt('Rename view:', view.name);
    if (!newName?.trim() || newName.trim() === view.name) return;
    try {
      await updateView(view.id, { name: newName.trim() });
    } catch (error) {
      alert(`Failed to rename view: ${error.message}`);
    }
  };

  const handleRenameTag = async (tag) => {
    const newName = window.prompt('Rename tag:', tag.name);
    if (!newName?.trim() || newName.trim() === tag.name) return;
    try {
      await updateTagName(tag.id, newName.trim());
    } catch (error) {
      alert(`Failed to rename tag: ${error.message}`);
    }
  };

  const handleTagDeleted = (tagId) => {
    if (activeTagIds?.includes(Number(tagId))) {
      handleClearFilters();
    }
  };

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
    setColumnFilters(JSON.parse(JSON.stringify(EMPTY_FILTERS)));
    setFilterModalMode('create');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenTagManager = () => {
    setTagManagerOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleApplyFiltersFromModal = (filters) => {
    const normalized = normalizeFilters(filters);
    setColumnFilters(normalized);
    setAppliedFilters(normalized);
  };

  const handlePreviewFiltersFromModal = useCallback(
    (filters, { includeSort = false, includeSearch = false } = {}) => {
      const { filterModalMode, editingView, activeType, search, sortField, sortDirection } =
        filterDepsRef.current;
      const assetType =
        filterModalMode === 'edit' && editingView?.asset_type ? editingView.asset_type : activeType;
      const normalized = mergeViewAssetTypeFilter(normalizeFilters(filters), assetType);
      setColumnFilters(normalized);
      clearView();

      const criteriaPatch = {
        statusFilter: 'all',
        viewId: null,
        tagIds: null,
        appliedFilters: normalized,
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
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortField,
    sortDirection,
    handleSort,
    setSort,
    views,
    activeView,
    applyView,
    clearView,
    viewsLoading,
    activeTagIds,
    handleApplyView,
    handleClearFilters,
    handleClearView: handleClearFilters,
    handleApplyTag,
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
  };
}
