'use client';

import { useState, useEffect, useRef } from 'react';
import FilterGroup from './CustomViews/components/FilterGroup';
import ViewFilterPreview from './CustomViews/components/ViewFilterPreview';
import { getFilterableColumns } from './CustomViews/utils';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { LOGIC_OPERATORS } from './AutomationRules/constants';
import Select from '@/components/shared/Select';
import OverlayPortal from '@/components/shared/OverlayPortal';
import { useTranslations } from 'next-intl';
import { EMPTY_FILTERS, hasActiveFilters, normalizeFilters } from './filters/filterHelpers';

/** @typedef {'create' | 'edit' | 'filter'} FilterModalMode */

export default function FilterEditorModal({
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
  previewItems = null,
  onPreview,
}) {
  const { saveView, updateView } = useCustomViews(apiKey);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const columnsT = useTranslations('Columns');

  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit' && !!editingView;

  const [isSaving, setIsSaving] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSort, setSaveSort] = useState(false);
  const [saveColumns, setSaveColumns] = useState(false);
  const [saveSearch, setSaveSearch] = useState(false);
  const [previewApplied, setPreviewApplied] = useState(false);

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

  const modeKey = isCreateMode ? 'create' : isEditMode ? `edit-${editingView?.id || ''}` : null;
  const prevModeKeyRef = useRef(null);
  if (prevModeKeyRef.current !== modeKey) {
    prevModeKeyRef.current = modeKey;
    setSaveViewName('');
    setShowSaveInput(isCreateMode);
    setSaveSort(isEditMode ? !!editingView?.sort_field : false);
    setSaveColumns(isEditMode ? !!editingView?.visible_columns : false);
    setSaveSearch(
      isCreateMode ? !!search?.trim() : isEditMode ? !!editingView?.search_query : false
    );
    setPreviewApplied(false);
  }

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

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

  useEffect(() => {
    if (isOpen) setPreviewApplied(false);
  }, [columnFilters, isOpen]);

  if (!isOpen) return null;

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

  const filtersToSave = () => ensureStructure(columnFilters);

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
    setPreviewApplied(true);
  };

  const handleClear = () => {
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    onApply?.(empty);
    onClose();
  };

  const saveOptionsRow = (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3 text-xs flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={saveSort}
            onChange={(e) => setSaveSort(e.target.checked)}
            className="size-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark"
          />
          <span>{customViewsT('includeSort')}</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={saveColumns}
            onChange={(e) => setSaveColumns(e.target.checked)}
            className="size-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark"
          />
          <span>{customViewsT('includeColumns')}</span>
        </label>
        <label
          className={`flex items-center gap-1.5 ${trimmedSearch ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
        >
          <input
            type="checkbox"
            checked={saveSearch}
            disabled={!trimmedSearch}
            onChange={(e) => setSaveSearch(e.target.checked)}
            className="size-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark"
          />
          <span>{customViewsT('includeSearch')}</span>
        </label>
      </div>
      {saveSearch && trimmedSearch && (
        <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60 truncate">
          {customViewsT('includeSearchHint', { query: trimmedSearch })}
        </p>
      )}
    </div>
  );

  const modalContent = (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} aria-hidden />
      <dialog
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl w-[calc(100vw-2rem)] sm:w-[min(92vw,56rem)] lg:w-[min(88vw,64rem)] max-h-[min(90vh,52rem)] overflow-hidden flex flex-col"
        aria-labelledby="filter-editor-title"
        open
      >
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark shrink-0">
            <h2
              id="filter-editor-title"
              className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
            >
              {modalTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
              aria-label={downloadsFiltersT('close')}
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isViewMode && saveOptionsRow}

            {isViewMode && previewItems && (filtersActive || previewSearchQuery) && (
              <ViewFilterPreview
                filters={columnFilters}
                previewItems={previewItems}
                assetType={previewAssetType}
                searchQuery={previewSearchQuery}
                onPreview={onPreview ? handlePreview : undefined}
                showPreviewButton={!!onPreview}
              />
            )}

            {previewApplied && isViewMode && (
              <p className="text-xs text-accent dark:text-accent-dark -mt-2">
                {customViewsT('previewApplied')}
              </p>
            )}

            {filterGroups.length === 0 ? (
              <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 italic text-center py-6">
                {customViewsT('noFilters')}
              </p>
            ) : (
              filterGroups.map((group, groupIndex) => (
                <div key={group._key || groupIndex} className="relative">
                  {groupIndex > 0 && (
                    <div className="absolute left-0 right-0 -top-4 flex items-center justify-center z-10">
                      <div className="px-3 py-1 text-xs font-medium text-primary-text/70 dark:text-primary-text-dark/70 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-full shadow-sm">
                        {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND
                          ? automationRulesT('logicOperators.and')
                          : automationRulesT('logicOperators.or')}
                      </div>
                    </div>
                  )}
                  <FilterGroup
                    group={group}
                    groupIndex={groupIndex}
                    totalGroups={filterGroups.length}
                    onUpdateGroup={handleUpdateGroup}
                    onRemoveGroup={handleRemoveGroup}
                    onAddFilter={handleAddFilter}
                    onUpdateFilter={handleUpdateFilter}
                    onRemoveFilter={handleRemoveFilter}
                    availableColumns={availableColumns}
                    apiKey={apiKey}
                    activeType={activeType}
                  />
                </div>
              ))
            )}

            {apiKey && filtersActive && !isCreateMode && !isEditMode && (
              <div className="pt-3 border-t border-border dark:border-border-dark">
                {!showSaveInput ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => setShowSaveInput(true)}
                        className="px-3 py-1.5 text-xs font-medium text-accent dark:text-accent-dark border border-accent dark:border-accent-dark rounded-md hover:bg-accent/10"
                      >
                        {customViewsT('saveAsNew')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {saveOptionsRow}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={saveViewName}
                        onChange={(e) => setSaveViewName(e.target.value)}
                        placeholder={customViewsT('viewNamePlaceholder')}
                        className="flex-1 px-3 py-1.5 text-sm border border-border dark:border-border-dark rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAsView();
                          if (e.key === 'Escape') {
                            setShowSaveInput(false);
                            setSaveViewName('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveAsView}
                        disabled={isSaving || !saveViewName.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md disabled:opacity-50"
                      >
                        {isSaving ? customViewsT('saving') : customViewsT('save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSaveInput(false);
                          setSaveViewName('');
                        }}
                        className="px-3 py-1.5 text-xs border border-border dark:border-border-dark rounded-md"
                      >
                        {customViewsT('cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 border-t border-border dark:border-border-dark shrink-0">
            {isCreateMode && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={saveViewName}
                    onChange={(e) => setSaveViewName(e.target.value)}
                    placeholder={customViewsT('viewNamePlaceholder')}
                    className="flex-1 px-3 py-2 text-sm border border-border dark:border-border-dark rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filtersActive && saveViewName.trim()) {
                        handleCreateView();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateView}
                    disabled={isSaving || !saveViewName.trim() || !filtersActive}
                    className="px-4 py-2 text-sm font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 disabled:opacity-50 shrink-0"
                  >
                    {isSaving ? customViewsT('creating') : customViewsT('createView')}
                  </button>
                </div>
                {!filtersActive && (
                  <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                    {customViewsT('noFilters')}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {filtersActive && !isCreateMode && (
                <>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="px-4 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90"
                  >
                    {downloadsFiltersT('applyFilters')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="px-3 py-1.5 text-xs border border-border dark:border-border-dark rounded-md"
                  >
                    {downloadsFiltersT('clearAll')}
                  </button>
                </>
              )}
              {isEditMode && filtersActive && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    className="px-3 py-1.5 text-xs font-medium text-accent dark:text-accent-dark border border-accent dark:border-accent-dark rounded-md hover:bg-accent/10"
                  >
                    {customViewsT('saveAsNew')}
                  </button>
                  <button
                    type="button"
                    onClick={handleUpdateView}
                    disabled={isSaving}
                    className="px-4 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 disabled:opacity-50"
                  >
                    {isSaving ? customViewsT('updating') : customViewsT('updateView')}
                  </button>
                </>
              )}
              {filterGroups.length > 1 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-primary-text/70">
                    {customViewsT('betweenGroups')}
                  </span>
                  <Select
                    value={groupLogicOperator}
                    onChange={(e) => handleGroupLogicChange(e.target.value)}
                    className="min-w-[80px] text-xs"
                  >
                    <option value={LOGIC_OPERATORS.AND}>
                      {automationRulesT('logicOperators.and')}
                    </option>
                    <option value={LOGIC_OPERATORS.OR}>
                      {automationRulesT('logicOperators.or')}
                    </option>
                  </Select>
                </div>
              )}
              <button
                type="button"
                onClick={handleAddGroup}
                className="px-3 py-1.5 text-xs border border-border dark:border-border-dark rounded-md"
              >
                + {customViewsT('addGroup')}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );

  return <OverlayPortal open={isOpen}>{modalContent}</OverlayPortal>;
}
