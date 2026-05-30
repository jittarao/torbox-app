'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { filtersFromView } from '@/components/downloads/FiltersSidebar';
import { useDownloadsFilterParams } from '@/hooks/useDownloadsFilterParams';
import {
  EMPTY_FILTERS,
  buildTagFilter,
  normalizeFilters,
  mergeViewAssetTypeFilter,
  getActiveTagIds,
} from '@/components/downloads/filters/filterHelpers';

export function useDownloadsFilters({
  apiKey,
  isBackendAvailable,
  activeType,
  setToast,
  handleColumnChange,
  updateTagName,
}) {
  const downloadsFiltersT = useTranslations('DownloadsFilters');

  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    appliedFilters,
    setAppliedFilters,
    patchFilterCriteria,
    sortField,
    sortDirection,
    setSort,
    resetFilters,
  } = useDownloadsFilterParams();

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

  const activeTagIds = getActiveTagIds(appliedFilters);

  const filterDepsRef = useRef({ filterModalMode, editingView, activeType, search, sortField, sortDirection });
  filterDepsRef.current = { filterModalMode, editingView, activeType, search, sortField, sortDirection };

  useEffect(() => {
    if (isBackendAvailable && apiKey && !viewsHasLoaded && !viewsLoading) {
      loadViews();
    }
  }, [apiKey, isBackendAvailable, viewsHasLoaded, viewsLoading, loadViews]);

  const handleApplyView = (view) => {
    applyView(view);

    const normalizedFilters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    setColumnFilters(normalizedFilters);

    const criteriaPatch = {
      statusFilter: 'all',
      appliedFilters: normalizedFilters,
      search: view.search_query || '',
    };
    if (view.sort_field) {
      criteriaPatch.sortField = view.sort_field;
      criteriaPatch.sortDirection = view.sort_direction || 'desc';
    }
    patchFilterCriteria(criteriaPatch);

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
  };

  const handleClearFilters = () => {
    clearView();
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    resetFilters();
  };

  const handleApplyTag = (tagId) => {
    const id = Number(tagId);
    const isActive = activeTagIds?.length === 1 && activeTagIds[0] === id && !activeView;

    if (isActive) {
      handleClearFilters();
      return;
    }

    clearView();
    const tagFilter = buildTagFilter(id);
    setColumnFilters(tagFilter);
    patchFilterCriteria({
      statusFilter: 'all',
      search: '',
      appliedFilters: tagFilter,
    });
    setMobileFiltersOpen(false);
  };

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
    handleApplyView(view);
    setToast({
      message: downloadsFiltersT('viewCreated', { name: view.name }),
      type: 'success',
    });
  };

  const handleViewUpdated = (view) => {
    if (activeView?.id === view.id) {
      handleApplyView(view);
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
    setAppliedFilters(normalizeFilters(filters));
  };

  const handlePreviewFiltersFromModal = useCallback(
    (filters, { includeSort = false, includeSearch = false } = {}) => {
      const { filterModalMode, editingView, activeType, search, sortField, sortDirection } = filterDepsRef.current;
      const assetType =
        filterModalMode === 'edit' && editingView?.asset_type ? editingView.asset_type : activeType;
      const normalized = mergeViewAssetTypeFilter(normalizeFilters(filters), assetType);
      setColumnFilters(normalized);
      clearView();

      const criteriaPatch = {
        statusFilter: 'all',
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
