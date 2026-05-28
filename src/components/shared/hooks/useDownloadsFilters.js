'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useFilter } from '@/components/shared/hooks/useFilter';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { filtersFromView } from '@/components/downloads/FiltersSidebar';
import {
  EMPTY_FILTERS,
  buildTagFilter,
  normalizeFilters,
  mergeViewAssetTypeFilter,
  getActiveTagIds,
} from '@/components/downloads/filters/filterHelpers';

export function useDownloadsFilters({
  enrichedDownloads,
  apiKey,
  isBackendAvailable,
  activeType,
  setSort,
  sortField,
  sortDirection,
  setToast,
  handleColumnChange,
  updateTagName,
}) {
  const downloadsFiltersT = useTranslations('DownloadsFilters');

  const [columnFilters, setColumnFilters] = useState(() =>
    JSON.parse(JSON.stringify(EMPTY_FILTERS))
  );
  const [appliedFilters, setAppliedFilters] = useState(() =>
    JSON.parse(JSON.stringify(EMPTY_FILTERS))
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filterModalMode, setFilterModalMode] = useState(null);
  const [editingView, setEditingView] = useState(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [tagManagerAutoCreate, setTagManagerAutoCreate] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { search, setSearch, statusFilter, setStatusFilter, filteredItems } = useFilter(
    enrichedDownloads,
    '',
    'all',
    appliedFilters
  );

  const {
    views,
    activeView,
    applyView,
    clearView,
    loadViews,
    updateView,
    loading: viewsLoading,
  } = useCustomViews(apiKey);

  const activeTagIds = useMemo(() => getActiveTagIds(appliedFilters), [appliedFilters]);

  useEffect(() => {
    if (isBackendAvailable && apiKey && views.length === 0 && !viewsLoading) {
      loadViews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, isBackendAvailable]);

  const handleApplyView = (view) => {
    applyView(view);
    setStatusFilter('all');

    const normalizedFilters = mergeViewAssetTypeFilter(view.filters, view.asset_type);
    setColumnFilters(normalizedFilters);
    setAppliedFilters(normalizedFilters);

    if (view.sort_field) {
      setSort(view.sort_field, view.sort_direction || 'desc');
    }

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

    setSearch(view.search_query || '');
    setMobileFiltersOpen(false);

    return visibleColumns;
  };

  const handleClearFilters = () => {
    clearView();
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    setAppliedFilters(empty);
    setSearch('');
  };

  const handleApplyTag = (tagId) => {
    const id = Number(tagId);
    const isActive = activeTagIds?.length === 1 && activeTagIds[0] === id && !activeView;

    if (isActive) {
      handleClearFilters();
      return;
    }

    clearView();
    setStatusFilter('all');
    setSearch('');
    const tagFilter = buildTagFilter(id);
    setColumnFilters(tagFilter);
    setAppliedFilters(tagFilter);
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
    setColumnFilters(normalizeFilters(appliedFilters));
    setFilterModalMode('filter');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenNewView = () => {
    clearView();
    setEditingView(null);
    setColumnFilters(JSON.parse(JSON.stringify(EMPTY_FILTERS)));
    setFilterModalMode('create');
    setFilterModalOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleOpenTagManager = (autoCreate = false) => {
    setTagManagerAutoCreate(autoCreate);
    setTagManagerOpen(true);
    setMobileFiltersOpen(false);
  };

  const handleNewTag = () => handleOpenTagManager(true);
  const handleManageTags = () => handleOpenTagManager(false);

  const handleApplyFiltersFromModal = (filters) => {
    setAppliedFilters(normalizeFilters(filters));
  };

  const handlePreviewFiltersFromModal = useCallback(
    (filters, { includeSort = false, includeSearch = false } = {}) => {
      const assetType =
        filterModalMode === 'edit' && editingView?.asset_type ? editingView.asset_type : activeType;
      const normalized = mergeViewAssetTypeFilter(normalizeFilters(filters), assetType);
      setColumnFilters(normalized);
      setAppliedFilters(normalized);
      clearView();

      if (includeSort && sortField) {
        setSort(sortField, sortDirection || 'desc');
      }

      if (includeSearch && search?.trim()) {
        setSearch(search.trim());
      } else if (!includeSearch) {
        setSearch('');
      }

      setStatusFilter('all');
    },
    [
      activeType,
      clearView,
      editingView,
      filterModalMode,
      search,
      setSort,
      sortDirection,
      sortField,
      setSearch,
      setStatusFilter,
    ]
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
    tagManagerAutoCreate,
    setTagManagerAutoCreate,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filteredItems,
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
    handleOpenNewView,
    handleOpenTagManager,
    handleNewTag,
    handleManageTags,
    handleApplyFiltersFromModal,
    handlePreviewFiltersFromModal,
  };
}
