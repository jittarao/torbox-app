'use client';

import { useState, useEffect, useRef } from 'react';
import { useModalFocusTrap } from '@/components/shared/hooks/useModalFocusTrap';
import { getFilterableColumns } from './CustomViews/utils';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { useTranslations } from 'next-intl';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  normalizeFilters,
  stampFilterSchemaVersion,
} from './filters/filterHelpers';
import { clonePresetFilters } from './CustomViews/presets';
import { LOGIC_OPERATORS } from './AutomationRules/constants';

export function useFilterEditorModal({
  isOpen,
  onClose,
  mode = 'filter',
  editingView = null,
  apiKey,
  activeType,
  columnFilters,
  setColumnFilters,
  onApply,
  onViewCreated,
  onViewUpdated,
  sortField,
  sortDirection,
  activeColumns,
  search = '',
  onPreview,
}) {
  const { saveView, updateView } = useCustomViews(apiKey);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const columnsT = useTranslations('Columns');
  const { alert, AppAlert } = useAppAlert();

  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit' && !!editingView;

  const [isSaving, setIsSaving] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSort, setSaveSort] = useState(false);
  const [saveColumns, setSaveColumns] = useState(false);
  const [saveSearch, setSaveSearch] = useState(false);
  const availableColumns = getFilterableColumns(columnsT, activeType);
  const isViewMode = isCreateMode || isEditMode;
  const trimmedSearch = search?.trim() || '';
  const previewAssetType =
    isEditMode && editingView?.asset_type ? editingView.asset_type : activeType;
  const previewSearchQuery = saveSearch ? trimmedSearch : null;

  const modalTitle = (() => {
    if (isCreateMode) return downloadsFiltersT('modalTitleCreate');
    if (isEditMode) return downloadsFiltersT('modalTitleEditNamed', { name: editingView.name });
    return downloadsFiltersT('modalTitle');
  })();

  const modalDescription = (() => {
    if (isCreateMode) return customViewsT('viewEditorDescriptionCreate');
    if (isEditMode) return customViewsT('viewEditorDescriptionEdit');
    return customViewsT('viewEditorDescriptionFilter');
  })();

  const dialogRef = useRef(null);
  const viewNameInputRef = useRef(null);
  useModalFocusTrap(isOpen, dialogRef);

  useEffect(() => {
    if (isOpen && isCreateMode) {
      requestAnimationFrame(() => viewNameInputRef.current?.focus());
    }
  }, [isOpen, isCreateMode]);

  const modeKey = isCreateMode ? 'create' : isEditMode ? `edit-${editingView?.id || ''}` : null;
  const prevModeKeyRef = useRef(null);

  useEffect(() => {
    if (!isOpen || prevModeKeyRef.current === modeKey) return;
    prevModeKeyRef.current = modeKey;
    setSaveViewName('');
    setShowSaveInput(isCreateMode);
    setSaveSort(isEditMode ? !!editingView?.sort_field : false);
    setSaveColumns(isEditMode ? !!editingView?.visible_columns : false);
    setSaveSearch(
      isCreateMode ? !!search?.trim() : isEditMode ? !!editingView?.search_query : false
    );
  }, [
    isOpen,
    modeKey,
    isCreateMode,
    isEditMode,
    editingView?.sort_field,
    editingView?.visible_columns,
    editingView?.search_query,
    search,
  ]);

  useEffect(() => {
    if (!isOpen || !columnFilters?.groups) return;

    const hasEmptyGroups = columnFilters.groups.some(
      (group) => !group.filters || group.filters.length === 0
    );

    if (hasEmptyGroups) {
      setColumnFilters((prev) => {
        if (!prev?.groups) return prev;
        const updatedGroups = prev.groups.map((group) => {
          if (!group.filters || group.filters.length === 0) {
            return {
              ...group,
              filters: [{ column: '', operator: '', value: null }],
            };
          }
          return group;
        });
        return { ...prev, groups: updatedGroups };
      });
    }
  }, [isOpen, columnFilters, setColumnFilters]);

  useEffect(() => {
    if (!isOpen) return;
    if (
      Array.isArray(columnFilters) &&
      columnFilters.length > 0 &&
      columnFilters[0]?.column !== undefined
    ) {
      setColumnFilters(normalizeFilters(columnFilters));
    } else if (
      !columnFilters?.groups ||
      !Array.isArray(columnFilters.groups) ||
      columnFilters.groups.length === 0
    ) {
      setColumnFilters(JSON.parse(JSON.stringify(EMPTY_FILTERS)));
    }
    // columnFilters, normalizeFilters, EMPTY_FILTERS intentionally omitted to
    // avoid resetting filters on every change — effect should only run on open/close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, setColumnFilters]);

  const filterGroups =
    columnFilters?.groups ||
    (Array.isArray(columnFilters)
      ? [{ logicOperator: LOGIC_OPERATORS.AND, filters: columnFilters }]
      : EMPTY_FILTERS.groups);

  const groupLogicOperator = columnFilters?.logicOperator || LOGIC_OPERATORS.AND;
  const filtersActive = hasActiveFilters(columnFilters);

  const ensureStructure = (prev) => {
    if (prev?.groups && Array.isArray(prev.groups)) return prev;
    if (Array.isArray(prev)) {
      return {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
    }
    return JSON.parse(JSON.stringify(EMPTY_FILTERS));
  };

  const handleAddGroup = () => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      return {
        ...current,
        groups: [
          ...current.groups,
          {
            _key: Math.random().toString(36).substring(2, 15),
            logicOperator: LOGIC_OPERATORS.AND,
            filters: [],
          },
        ],
      };
    });
  };

  const handleUpdateGroup = (groupIndex, field, value) => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      const newGroups = [...current.groups];
      newGroups[groupIndex] = { ...newGroups[groupIndex], [field]: value };
      return { ...current, groups: newGroups };
    });
  };

  const handleRemoveGroup = (groupIndex) => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      const newGroups = current.groups.filter((_, i) => i !== groupIndex);
      return {
        ...current,
        groups:
          newGroups.length === 0
            ? [
                {
                  _key: Math.random().toString(36).substring(2, 15),
                  logicOperator: LOGIC_OPERATORS.AND,
                  filters: [],
                },
              ]
            : newGroups,
      };
    });
  };

  const handleAddFilter = (groupIndex) => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      const newGroups = [...current.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        filters: [
          ...(newGroups[groupIndex].filters || []),
          {
            _key: Math.random().toString(36).substring(2, 15),
            column: '',
            operator: '',
            value: null,
          },
        ],
      };
      return { ...current, groups: newGroups };
    });
  };

  const handleUpdateFilter = (groupIndex, filterIndex, field, value) => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      const newGroups = [...current.groups];
      const newFilters = [...(newGroups[groupIndex].filters || [])];
      newFilters[filterIndex] = { ...newFilters[filterIndex], [field]: value };
      newGroups[groupIndex] = { ...newGroups[groupIndex], filters: newFilters };
      return { ...current, groups: newGroups };
    });
  };

  const handleRemoveFilter = (groupIndex, filterIndex) => {
    setColumnFilters((prev) => {
      const current = ensureStructure(prev);
      const newGroups = [...current.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        filters: newGroups[groupIndex].filters.filter((_, i) => i !== filterIndex),
      };
      return { ...current, groups: newGroups };
    });
  };

  const handleGroupLogicChange = (newLogic) => {
    setColumnFilters((prev) => ({ ...ensureStructure(prev), logicOperator: newLogic }));
  };

  const filtersToSave = () => stampFilterSchemaVersion(ensureStructure(columnFilters));

  const handleApplyPreset = (preset) => {
    const filters = clonePresetFilters(preset);
    setColumnFilters(filters);
    setSaveViewName(preset.name);
    onPreview?.(filters, { includeSort: !!preset.sort });
  };

  const handleSavePreset = async (preset) => {
    if (!apiKey) return;
    setIsSaving(true);
    try {
      const view = await saveView(
        preset.name,
        clonePresetFilters(preset),
        preset.sort ?? null,
        null,
        preset.asset_type ?? activeType,
        null
      );
      onViewCreated?.(view);
      onClose();
    } catch (error) {
      console.error('Error saving preset view:', error);
      alert(`Failed to save view: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsView = async () => {
    if (!apiKey || !saveViewName.trim()) return;
    setIsSaving(true);
    try {
      const view = await saveView(
        saveViewName.trim(),
        filtersToSave(),
        saveSort ? { field: sortField, direction: sortDirection } : null,
        saveColumns ? activeColumns : null,
        activeType,
        saveSearch ? search?.trim() || null : null
      );
      setSaveViewName('');
      setShowSaveInput(false);
      setSaveSort(false);
      setSaveColumns(false);
      setSaveSearch(false);
      onViewCreated?.(view);
      onClose();
    } catch (error) {
      console.error('Error saving view:', error);
      alert(`Failed to save view: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateView = () => handleSaveAsView();

  const handleUpdateView = async () => {
    if (!apiKey || !editingView) return;
    setIsSaving(true);
    try {
      const updates = { filters: filtersToSave() };
      if (saveSort) {
        updates.sort_field = sortField || null;
        updates.sort_direction = sortDirection || null;
      } else {
        updates.sort_field = null;
        updates.sort_direction = null;
      }
      if (saveColumns) {
        updates.visible_columns = activeColumns || null;
      } else {
        updates.visible_columns = null;
      }
      if (saveSearch) {
        updates.search_query = search?.trim() || null;
      } else {
        updates.search_query = null;
      }
      const view = await updateView(editingView.id, updates);
      onViewUpdated?.(view);
      onClose();
    } catch (error) {
      console.error('Error updating view:', error);
      alert(`Failed to update view: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSaveAsNew = () => {
    setShowSaveInput(false);
    setSaveViewName('');
  };

  const handleStartSaveAsNew = () => {
    setShowSaveInput(true);
    if (isEditMode && editingView?.name) {
      setSaveViewName(`${editingView.name} copy`);
    }
  };

  const handleApply = () => {
    onApply?.(columnFilters);
    onClose();
  };

  const handlePreview = () => {
    if (!filtersActive && !previewSearchQuery) return;
    onPreview?.(filtersToSave(), {
      includeSort: saveSort,
      includeSearch: saveSearch,
    });
    onClose();
  };

  const handleClear = () => {
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    onApply?.(empty);
    onClose();
  };

  return {
    isOpen,
    onClose,
    mode,
    editingView,
    apiKey,
    activeType,
    columnFilters,
    previewItems,
    onPreview,
    saveView,
    updateView,
    customViewsT,
    automationRulesT,
    downloadsFiltersT,
    alert,
    AppAlert,
    isCreateMode,
    isEditMode,
    isSaving,
    saveViewName,
    setSaveViewName,
    showSaveInput,
    saveSort,
    setSaveSort,
    saveColumns,
    setSaveColumns,
    saveSearch,
    setSaveSearch,
    availableColumns,
    isViewMode,
    trimmedSearch,
    previewAssetType,
    previewSearchQuery,
    modalTitle,
    modalDescription,
    dialogRef,
    viewNameInputRef,
    filterGroups,
    groupLogicOperator,
    filtersActive,
    handleAddGroup,
    handleUpdateGroup,
    handleRemoveGroup,
    handleAddFilter,
    handleUpdateFilter,
    handleRemoveFilter,
    handleGroupLogicChange,
    handleApplyPreset,
    handleSavePreset,
    handleSaveAsView,
    handleCreateView,
    handleUpdateView,
    handleCancelSaveAsNew,
    handleStartSaveAsNew,
    handleApply,
    handlePreview,
    handleClear,
    sortField,
    sortDirection,
    activeColumns,
    search,
  };
}
