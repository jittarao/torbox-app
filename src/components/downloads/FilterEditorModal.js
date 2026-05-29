'use client';

import { useState, useEffect, useRef } from 'react';
import { useModalFocusTrap } from '@/components/shared/hooks/useModalFocusTrap';
import FilterGroup from './CustomViews/components/FilterGroup';
import ViewFilterPreview from './CustomViews/components/ViewFilterPreview';
import { getFilterableColumns } from './CustomViews/utils';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { LOGIC_OPERATORS } from './AutomationRules/constants';
import Select from '@/components/shared/Select';
import OverlayPortal from '@/components/shared/OverlayPortal';
import ModalSheetHandle from '@/components/shared/ModalSheetHandle';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import { EMPTY_FILTERS, hasActiveFilters, normalizeFilters } from './filters/filterHelpers';

function SaveOptionToggle({ checked, disabled, onChange, label, hint }) {
  return (
    <label
      className={`flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors sm:min-w-[7.5rem] sm:basis-auto ${
        disabled
          ? 'cursor-not-allowed border-border/40 opacity-50 dark:border-border-dark/40'
          : checked
            ? 'border-accent/40 bg-accent/10 dark:border-accent-dark/40 dark:bg-accent-dark/10'
            : 'border-border/60 bg-surface-alt/40 hover:border-border dark:border-border-dark/60 dark:bg-surface-alt-dark/30 dark:hover:border-border-dark'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="size-3.5 rounded border-border text-accent focus:ring-accent/30 dark:border-border-dark dark:text-accent-dark"
        />
        <span className="text-xs font-medium text-primary-text dark:text-primary-text-dark">{label}</span>
      </span>
      {hint && (
        <span className="pl-5 text-[10px] leading-snug text-primary-text/50 dark:text-primary-text-dark/50 truncate">
          {hint}
        </span>
      )}
    </label>
  );
}

function SaveOptionsPanel({
  saveSort,
  setSaveSort,
  saveColumns,
  setSaveColumns,
  saveSearch,
  setSaveSearch,
  trimmedSearch,
  t,
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface-alt/25 p-3 dark:border-border-dark/50 dark:bg-surface-alt-dark/20">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary-text/45 dark:text-primary-text-dark/45">
        {t('viewEditorSaveOptions')}
      </p>
      <div className="flex flex-wrap gap-2">
        <SaveOptionToggle
          checked={saveSort}
          onChange={(e) => setSaveSort(e.target.checked)}
          label={t('includeSort')}
        />
        <SaveOptionToggle
          checked={saveColumns}
          onChange={(e) => setSaveColumns(e.target.checked)}
          label={t('includeColumns')}
        />
        <SaveOptionToggle
          checked={saveSearch}
          disabled={!trimmedSearch}
          onChange={(e) => setSaveSearch(e.target.checked)}
          label={t('includeSearch')}
          hint={saveSearch && trimmedSearch ? t('includeSearchHint', { query: trimmedSearch }) : undefined}
        />
      </div>
    </div>
  );
}

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
  if (prevModeKeyRef.current !== modeKey) {
    prevModeKeyRef.current = modeKey;
    setSaveViewName('');
    setShowSaveInput(isCreateMode);
    setSaveSort(isEditMode ? !!editingView?.sort_field : false);
    setSaveColumns(isEditMode ? !!editingView?.visible_columns : false);
    setSaveSearch(
      isCreateMode ? !!search?.trim() : isEditMode ? !!editingView?.search_query : false
    );
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
    onClose();
  };

  const handleClear = () => {
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    onApply?.(empty);
    onClose();
  };

  const modalContent = (
    <>
      <button
        type="button"
        className="z-overlay-backdrop fixed inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label={downloadsFiltersT('close')}
      />

      <dialog
        ref={dialogRef}
        className="ui-modal-sheet ui-modal-sheet--wide"
        aria-labelledby="filter-editor-title"
        aria-describedby="filter-editor-description"
        aria-modal="true"
        open
      >
        <div onClick={(e) => e.stopPropagation()} className="flex min-h-0 flex-1 flex-col">
          <ModalSheetHandle />
          {/* Header */}
          <div className="relative shrink-0 border-b border-border/50 px-4 pb-2.5 sm:overflow-hidden sm:px-5 sm:pb-4 sm:pt-5 dark:border-border-dark/50">
            <div
              className="pointer-events-none absolute inset-0 hidden bg-gradient-to-br from-accent/8 via-transparent to-transparent dark:from-accent-dark/10 sm:block"
              aria-hidden
            />
            <div className="relative flex items-center gap-2 sm:items-start sm:gap-3">
              <div
                className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent ring-1 ring-accent/20 dark:bg-accent-dark/15 dark:text-accent-dark dark:ring-accent-dark/25 sm:flex"
                aria-hidden
              >
                <Icons.Filter className="size-5" />
              </div>
              <div className="min-w-0 flex-1 sm:pt-0.5">
                <h2
                  id="filter-editor-title"
                  className="truncate text-base font-semibold tracking-tight text-primary-text dark:text-primary-text-dark sm:text-lg"
                >
                  {modalTitle}
                </h2>
                <p
                  id="filter-editor-description"
                  className="mt-1 hidden text-sm leading-relaxed text-primary-text/60 dark:text-primary-text-dark/60 sm:block"
                >
                  {modalDescription}
                </p>
                <p className="sr-only sm:hidden">{modalDescription}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary-text/60 transition-colors hover:bg-surface-alt hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:bg-surface-alt-dark dark:hover:text-primary-text-dark sm:-mt-1 sm:size-9 sm:rounded-xl"
                aria-label={downloadsFiltersT('close')}
              >
                <Icons.X className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          {/* Create view: name + primary action */}
          {isCreateMode && (
            <div className="shrink-0 border-b border-border/40 px-4 py-3 sm:px-5 sm:py-4 dark:border-border-dark/40">
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-start"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (filtersActive && saveViewName.trim()) handleCreateView();
                }}
              >
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor="view-name-input"
                    className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-primary-text/45 dark:text-primary-text-dark/45"
                  >
                    {customViewsT('viewEditorNameLabel')}
                  </label>
                  <input
                    id="view-name-input"
                    ref={viewNameInputRef}
                    type="text"
                    value={saveViewName}
                    onChange={(e) => setSaveViewName(e.target.value)}
                    placeholder={customViewsT('viewNamePlaceholder')}
                    className="w-full rounded-xl border border-border/80 bg-surface-alt/50 px-3 py-2.5 text-sm text-primary-text placeholder:text-primary-text/40 focus:border-accent/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-border-dark/80 dark:bg-surface-alt-dark/40 dark:text-primary-text-dark dark:focus:border-accent-dark/50 dark:focus:bg-surface-dark dark:focus:ring-accent-dark/15"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving || !saveViewName.trim() || !filtersActive}
                  className="ui-btn-accent w-full shrink-0 !rounded-xl !px-5 sm:mt-6 sm:w-auto sm:min-w-[8.5rem]"
                >
                  {isSaving ? (
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    customViewsT('createView')
                  )}
                </button>
              </form>
              {!filtersActive && (
                <p className="mt-2 text-xs text-primary-text/55 dark:text-primary-text-dark/55">
                  {customViewsT('noFilters')}
                </p>
              )}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4 sm:px-5 sm:py-4">
            {isViewMode && (
              <SaveOptionsPanel
                saveSort={saveSort}
                setSaveSort={setSaveSort}
                saveColumns={saveColumns}
                setSaveColumns={setSaveColumns}
                saveSearch={saveSearch}
                setSaveSearch={setSaveSearch}
                trimmedSearch={trimmedSearch}
                t={customViewsT}
              />
            )}

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

            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary-text/45 dark:text-primary-text-dark/45">
                  {customViewsT('viewEditorFiltersSection')}
                </h3>
                {filterGroups.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-primary-text/50 dark:text-primary-text-dark/50">
                      {customViewsT('betweenGroups')}
                    </span>
                    <Select
                      value={groupLogicOperator}
                      onChange={(e) => handleGroupLogicChange(e.target.value)}
                      className="min-w-[5.5rem] !rounded-lg text-xs"
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
              </div>

              {filterGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center dark:border-border-dark/60">
                  <Icons.Filter className="mb-2 size-8 text-primary-text/25 dark:text-primary-text-dark/25" aria-hidden />
                  <p className="text-sm text-primary-text/60 dark:text-primary-text-dark/60">
                    {customViewsT('noFilters')}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filterGroups.map((group, groupIndex) => (
                    <div key={group._key || groupIndex} className="relative">
                      {groupIndex > 0 && (
                        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
                          <span className="inline-flex rounded-full border border-border/60 bg-surface px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-text/55 shadow-sm dark:border-border-dark/60 dark:bg-surface-dark dark:text-primary-text-dark/55">
                            {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND
                              ? automationRulesT('logicOperators.and')
                              : automationRulesT('logicOperators.or')}
                          </span>
                        </div>
                      )}
                      <div className="rounded-xl ring-1 ring-border/50 dark:ring-border-dark/50">
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            {apiKey && filtersActive && !isCreateMode && showSaveInput && (
              <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 dark:border-accent-dark/25 dark:bg-accent-dark/5">
                <SaveOptionsPanel
                  saveSort={saveSort}
                  setSaveSort={setSaveSort}
                  saveColumns={saveColumns}
                  setSaveColumns={setSaveColumns}
                  saveSearch={saveSearch}
                  setSaveSearch={setSaveSearch}
                  trimmedSearch={trimmedSearch}
                  t={customViewsT}
                />
                <form
                  className="mt-3 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveAsView();
                  }}
                >
                  <input
                    type="text"
                    value={saveViewName}
                    onChange={(e) => setSaveViewName(e.target.value)}
                    placeholder={customViewsT('viewNamePlaceholder')}
                    className="min-w-0 flex-1 rounded-xl border border-border/80 bg-surface px-3 py-2 text-sm focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-border-dark/80 dark:bg-surface-dark dark:focus:ring-accent-dark/15"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setShowSaveInput(false);
                        setSaveViewName('');
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
                    <button
                      type="submit"
                      disabled={isSaving || !saveViewName.trim()}
                      className="ui-btn-accent w-full !rounded-xl !py-2 !text-xs sm:w-auto"
                    >
                      {isSaving ? customViewsT('saving') : customViewsT('save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSaveInput(false);
                        setSaveViewName('');
                      }}
                      className="ui-btn-ghost w-full !rounded-xl !py-2 !text-xs sm:w-auto"
                    >
                      {customViewsT('cancel')}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-5 sm:py-4 dark:border-border-dark/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {filtersActive && !isCreateMode && !isEditMode && (
                <div className="flex flex-col gap-2 sm:contents">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="ui-btn-accent w-full justify-center !rounded-xl !text-xs sm:w-auto"
                  >
                    {downloadsFiltersT('applyFilters')}
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="ui-btn-ghost w-full justify-center !rounded-xl !text-xs sm:w-auto"
                  >
                    {downloadsFiltersT('clearAll')}
                  </button>
                  {!showSaveInput && (
                    <button
                      type="button"
                      onClick={() => setShowSaveInput(true)}
                      className="ui-btn-ghost w-full justify-center !rounded-xl !text-xs border border-border/60 dark:border-border-dark/60 sm:w-auto"
                    >
                      {customViewsT('saveAsNew')}
                    </button>
                  )}
                </div>
              )}

              {isEditMode && filtersActive && (
                <div className="flex flex-col gap-2 sm:contents">
                  <button
                    type="button"
                    onClick={handleUpdateView}
                    disabled={isSaving}
                    className="ui-btn-accent w-full justify-center !rounded-xl !text-xs sm:w-auto"
                  >
                    {isSaving ? customViewsT('updating') : customViewsT('updateView')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveInput(true)}
                    className="ui-btn-ghost w-full justify-center !rounded-xl !text-xs border border-border/60 dark:border-border-dark/60 sm:w-auto"
                  >
                    {customViewsT('saveAsNew')}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddGroup}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-primary-text transition-colors hover:bg-surface-alt dark:border-border-dark/60 dark:text-primary-text-dark dark:hover:bg-surface-alt-dark sm:ml-auto sm:w-auto"
              >
                <Icons.Plus className="size-3.5" aria-hidden />
                {customViewsT('addGroup')}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );

  return <OverlayPortal open={isOpen}>{modalContent}</OverlayPortal>;
}
