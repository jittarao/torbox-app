'use client';

import { useState, useEffect } from 'react';
import FilterGroup from './CustomViews/components/FilterGroup';
import { getFilterableColumns } from './CustomViews/utils';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import { LOGIC_OPERATORS } from './AutomationRules/constants';
import Select from '@/components/shared/Select';
import { useTranslations } from 'next-intl';
import { EMPTY_FILTERS, hasActiveFilters, normalizeFilters } from './filters/filterHelpers';

export default function FilterEditorModal({
  isOpen,
  onClose,
  apiKey,
  activeType,
  columnFilters,
  setColumnFilters,
  activeView,
  onApply,
  sortField,
  sortDirection,
  activeColumns,
}) {
  const { saveView, updateView } = useCustomViews(apiKey);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');
  const downloadsFiltersT = useTranslations('DownloadsFilters');
  const columnsT = useTranslations('Columns');

  const [isSaving, setIsSaving] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSort, setSaveSort] = useState(false);
  const [saveColumns, setSaveColumns] = useState(false);

  const availableColumns = getFilterableColumns(columnsT, activeType);

  useEffect(() => {
    if (!isOpen) return;
    if (activeView) {
      setSaveSort(!!activeView.sort_field);
      setSaveColumns(!!activeView.visible_columns);
    } else {
      setSaveSort(false);
      setSaveColumns(false);
    }
  }, [activeView, isOpen]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const filterGroups =
    columnFilters?.groups ||
    (Array.isArray(columnFilters) ? [{ logicOperator: LOGIC_OPERATORS.AND, filters: columnFilters }] : EMPTY_FILTERS.groups);

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
          { logicOperator: LOGIC_OPERATORS.AND, filters: [] },
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
            ? [{ logicOperator: LOGIC_OPERATORS.AND, filters: [] }]
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
          { column: '', operator: '', value: null },
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
      await saveView(
        saveViewName.trim(),
        filtersToSave(),
        saveSort ? { field: sortField, direction: sortDirection } : null,
        saveColumns ? activeColumns : null,
        activeType
      );
      setSaveViewName('');
      setShowSaveInput(false);
      setSaveSort(false);
      setSaveColumns(false);
    } catch (error) {
      console.error('Error saving view:', error);
      alert(`Failed to save view: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateView = async () => {
    if (!apiKey || !activeView) return;
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
      await updateView(activeView.id, updates);
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

  const handleClear = () => {
    const empty = JSON.parse(JSON.stringify(EMPTY_FILTERS));
    setColumnFilters(empty);
    onApply?.(empty);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl w-[calc(100vw-2rem)] sm:w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-editor-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark shrink-0">
          <h2
            id="filter-editor-title"
            className="text-lg font-semibold text-primary-text dark:text-primary-text-dark"
          >
            {downloadsFiltersT('modalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
            aria-label={downloadsFiltersT('close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filterGroups.length === 0 ? (
            <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 italic text-center py-6">
              {customViewsT('noFilters')}
            </p>
          ) : (
            filterGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="relative">
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

          {apiKey && filtersActive && (
            <div className="pt-3 border-t border-border dark:border-border-dark">
              {!showSaveInput ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  {activeView && (
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveSort}
                          onChange={(e) => setSaveSort(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark"
                        />
                        <span>{customViewsT('includeSort')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveColumns}
                          onChange={(e) => setSaveColumns(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark"
                        />
                        <span>{customViewsT('includeColumns')}</span>
                      </label>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeView && (
                      <button
                        type="button"
                        onClick={handleUpdateView}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 disabled:opacity-50"
                      >
                        {isSaving ? customViewsT('updating') : customViewsT('updateView')}
                      </button>
                    )}
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

        <div className="flex flex-wrap items-center gap-2 p-4 border-t border-border dark:border-border-dark shrink-0">
          {filtersActive && (
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
          {filterGroups.length > 1 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-primary-text/70">{customViewsT('betweenGroups')}</span>
              <Select
                value={groupLogicOperator}
                onChange={(e) => handleGroupLogicChange(e.target.value)}
                className="min-w-[80px] text-xs"
              >
                <option value={LOGIC_OPERATORS.AND}>{automationRulesT('logicOperators.and')}</option>
                <option value={LOGIC_OPERATORS.OR}>{automationRulesT('logicOperators.or')}</option>
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
    </>
  );
}
