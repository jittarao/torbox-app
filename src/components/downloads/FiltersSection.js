'use client';

import { useState, useEffect } from 'react';
import FilterGroup from './CustomViews/components/FilterGroup';
import { getFilterableColumns } from './CustomViews/utils';
import { useCustomViews } from '@/components/shared/hooks/useCustomViews';
import CustomViews from './CustomViews';
import { LOGIC_OPERATORS } from './AutomationRules/constants';
import Select from '@/components/shared/Select';
import TagManager from './Tags/TagManager';
import { useTranslations } from 'next-intl';

export default function FiltersSection({
  apiKey,
  activeType,
  columnFilters,
  setColumnFilters,
  activeView,
  onApplyView,
  onClearView,
  onFiltersChange,
  sortField,
  sortDirection,
  activeColumns,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { views, saveView, deleteView, updateView } = useCustomViews(apiKey);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');

  // When updating a view, set checkboxes based on existing view data
  useEffect(() => {
    if (activeView) {
      // Check if view has sort_field and visible_columns
      setSaveSort(!!activeView.sort_field);
      setSaveColumns(!!activeView.visible_columns);
    } else {
      // Reset checkboxes when no view is active
      setSaveSort(false);
      setSaveColumns(false);
    }
  }, [activeView]);

  // Ensure each group has at least one empty filter
  useEffect(() => {
    if (isExpanded && columnFilters && columnFilters.groups && Array.isArray(columnFilters.groups)) {
      const hasEmptyGroups = columnFilters.groups.some(group => 
        !group.filters || group.filters.length === 0
      );
      
      if (hasEmptyGroups) {
        setColumnFilters(prev => {
          if (!prev || !prev.groups || !Array.isArray(prev.groups)) return prev;
          
          const updatedGroups = prev.groups.map(group => {
            // If group has no filters, add one empty filter
            if (!group.filters || group.filters.length === 0) {
              return {
                ...group,
                filters: [{ column: '', operator: '', value: null }],
              };
            }
            return group;
          });
          
          return {
            ...prev,
            groups: updatedGroups,
          };
        });
      }
    }
  }, [isExpanded, columnFilters]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveSort, setSaveSort] = useState(false);
  const [saveColumns, setSaveColumns] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  const availableColumns = getFilterableColumns(activeType);

  // Initialize filter groups structure if needed (only once on mount)
  useEffect(() => {
    // Check if columnFilters is in the old flat array format
    if (Array.isArray(columnFilters) && columnFilters.length > 0 && columnFilters[0]?.column !== undefined) {
      // Convert old flat structure to new group structure
      setColumnFilters({
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [
          {
            logicOperator: LOGIC_OPERATORS.AND,
            filters: columnFilters,
          },
        ],
      });
    } else if (Array.isArray(columnFilters) && columnFilters.length === 0) {
      // Initialize with empty group structure
      setColumnFilters({
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [
          {
            logicOperator: LOGIC_OPERATORS.AND,
            filters: [],
          },
        ],
      });
    } else if (!columnFilters || !columnFilters.groups || !Array.isArray(columnFilters.groups) || columnFilters.groups.length === 0) {
      // Ensure it has the proper structure with at least one empty group
      setColumnFilters({
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [
          {
            logicOperator: LOGIC_OPERATORS.AND,
            filters: [],
          },
        ],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Normalize filter structure - ensure it's always in group format
  const filterGroups = (columnFilters && columnFilters.groups)
    ? columnFilters.groups
    : (Array.isArray(columnFilters) && columnFilters.length > 0 && columnFilters[0]?.column !== undefined
      ? [{ logicOperator: LOGIC_OPERATORS.AND, filters: columnFilters }]
      : [{ logicOperator: LOGIC_OPERATORS.AND, filters: [] }]);
  const groupLogicOperator = (columnFilters && columnFilters.logicOperator) || LOGIC_OPERATORS.AND;

  const handleAddGroup = () => {
    setColumnFilters(prev => {
      // Ensure we have a proper structure
      let current;
      if (prev && prev.groups && Array.isArray(prev.groups)) {
        current = prev;
      } else if (Array.isArray(prev)) {
        // Old flat structure
        current = {
          logicOperator: LOGIC_OPERATORS.AND,
          groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
        };
      } else {
        // Empty or invalid structure - create default
        current = {
          logicOperator: LOGIC_OPERATORS.AND,
          groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: [] }],
        };
      }
      
      return {
        ...current,
        groups: [
          ...current.groups,
          {
            logicOperator: LOGIC_OPERATORS.AND,
            filters: [],
          },
        ],
      };
    });
  };

  const handleUpdateGroup = (groupIndex, field, value) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      const newGroups = [...current.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        [field]: value,
      };
      return {
        ...current,
        groups: newGroups,
      };
    });
  };

  const handleRemoveGroup = (groupIndex) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      const newGroups = current.groups.filter((_, i) => i !== groupIndex);
      if (newGroups.length === 0) {
        return {
          logicOperator: LOGIC_OPERATORS.AND,
          groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: [] }],
        };
      }
      return {
        ...current,
        groups: newGroups,
      };
    });
  };

  const handleAddFilter = (groupIndex) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      const newGroups = [...current.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        filters: [
          ...(newGroups[groupIndex].filters || []),
          { column: '', operator: '', value: null },
        ],
      };
      return {
        ...current,
        groups: newGroups,
      };
    });
  };

  const handleUpdateFilter = (groupIndex, filterIndex, field, value) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      const newGroups = [...current.groups];
      const newFilters = [...(newGroups[groupIndex].filters || [])];
      newFilters[filterIndex] = {
        ...newFilters[filterIndex],
        [field]: value,
      };
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        filters: newFilters,
      };
      return {
        ...current,
        groups: newGroups,
      };
    });
  };

  const handleRemoveFilter = (groupIndex, filterIndex) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      const newGroups = [...current.groups];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        filters: newGroups[groupIndex].filters.filter((_, i) => i !== filterIndex),
      };
      return {
        ...current,
        groups: newGroups,
      };
    });
  };

  const handleGroupLogicChange = (newLogic) => {
    setColumnFilters(prev => {
      const current = prev.groups ? prev : {
        logicOperator: LOGIC_OPERATORS.AND,
        groups: [{ logicOperator: LOGIC_OPERATORS.AND, filters: prev }],
      };
      return {
        ...current,
        logicOperator: newLogic,
      };
    });
  };

  const handleSaveAsView = async () => {
    if (!apiKey || !saveViewName.trim()) return;

    setIsSaving(true);
    try {
      // Normalize filters structure before saving
      const filtersToSave = columnFilters.groups
        ? columnFilters
        : {
            logicOperator: LOGIC_OPERATORS.AND,
            groups: [
              {
                logicOperator: LOGIC_OPERATORS.AND,
                filters: columnFilters.filter(f => f.column),
              },
            ],
          };

      await saveView(
        saveViewName.trim(),
        filtersToSave,
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
      // Normalize filters structure before updating
      const filtersToSave = columnFilters.groups
        ? columnFilters
        : {
            logicOperator: LOGIC_OPERATORS.AND,
            groups: [
              {
                logicOperator: LOGIC_OPERATORS.AND,
                filters: columnFilters.filter(f => f.column),
              },
            ],
          };

      const updates = {
        filters: filtersToSave,
      };

      // Include sort if checkbox is checked
      if (saveSort) {
        updates.sort_field = sortField || null;
        updates.sort_direction = sortDirection || null;
      } else {
        // If unchecked, clear sort
        updates.sort_field = null;
        updates.sort_direction = null;
      }

      // Include columns if checkbox is checked
      if (saveColumns) {
        updates.visible_columns = activeColumns || null;
      } else {
        // If unchecked, clear columns
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

  const handleDeleteView = async (viewId) => {
    if (!confirm('Are you sure you want to delete this view?')) return;

    try {
      await deleteView(viewId);
      if (activeView?.id === viewId) {
        onClearView();
      }
    } catch (error) {
      console.error('Error deleting view:', error);
      alert(`Failed to delete view: ${error.message}`);
    }
  };

  // Check if there are any active filters
  const hasActiveFilters = filterGroups.some(group =>
    group.filters && group.filters.some(f => f.column)
  );
  const activeFilterCount = filterGroups.reduce((count, group) =>
    count + (group.filters?.filter(f => f.column).length || 0), 0
  );

  return (
    <div className="mb-4">
      {/* Header */}
      <div className={`flex sm:justify-between gap-2 sm:gap-3 ${isExpanded ? 'flex-col sm:flex-row' : 'flex-col'}`}>
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 sm:gap-2 text-sm font-semibold text-primary-text dark:text-primary-text-dark hover:text-accent dark:hover:text-accent-dark transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className='flex justify-between items-center gap-2'>
            {/* View Selector - Show inline when not expanded */}
            {apiKey && views.length > 0 && !isExpanded && (
              <div className="flex items-center gap-1.5">
                <CustomViews
                  views={views}
                  activeView={activeView}
                  onSelectView={onApplyView}
                  onClearView={onClearView}
                  onEditView={(view) => {
                    // Load view into filters for editing
                    if (view.filters) {
                      if (view.filters.groups) {
                        setColumnFilters(view.filters);
                      } else if (Array.isArray(view.filters)) {
                        setColumnFilters({
                          logicOperator: LOGIC_OPERATORS.AND,
                          groups: [
                            {
                              logicOperator: LOGIC_OPERATORS.AND,
                              filters: view.filters,
                            },
                          ],
                        });
                      }
                    }
                    setIsExpanded(true);
                  }}
                  onDeleteView={handleDeleteView}
                />
              </div>
            )}

            {/* Manage Tags Button - Show when not expanded */}
            {apiKey && !isExpanded && (
              <button
                type="button"
                onClick={() => setShowTagManager(true)}
                className="px-2 py-1 text-xs font-medium text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors flex items-center justify-center gap-1"
                title="Manage tags"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <span className="hidden sm:inline">Tags</span>
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {/* View Selector - Show in right section when expanded */}
            {apiKey && views.length > 0 && (
              <div className="flex items-center gap-2">
                <CustomViews
                  views={views}
                  activeView={activeView}
                  onSelectView={onApplyView}
                  onClearView={onClearView}
                  onEditView={(view) => {
                    // Load view into filters for editing
                    if (view.filters) {
                      if (view.filters.groups) {
                        setColumnFilters(view.filters);
                      } else if (Array.isArray(view.filters)) {
                        setColumnFilters({
                          logicOperator: LOGIC_OPERATORS.AND,
                          groups: [
                            {
                              logicOperator: LOGIC_OPERATORS.AND,
                              filters: view.filters,
                            },
                          ],
                        });
                      }
                    }
                    setIsExpanded(true);
                  }}
                  onDeleteView={handleDeleteView}
                />
              </div>
            )}

            {/* Manage Tags Button */}
            {apiKey && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTagManager(true)}
                  className="px-2 py-1 text-xs font-medium text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors flex items-center justify-center gap-1"
                  title="Manage tags"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Manage Tags</span>
                </button>
              </div>
            )}

              <div className="flex flex-wrap items-center gap-2 sm:pl-3 sm:border-l sm:border-border sm:dark:border-border-dark">
                {hasActiveFilters && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        // Apply filters to the table
                        if (onFiltersChange) {
                          onFiltersChange(columnFilters);
                        }
                      }}
                      className="px-4 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 transition-opacity shadow-sm"
                    >
                      Apply Filters
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Clear all filters
                        const emptyFilters = {
                          logicOperator: LOGIC_OPERATORS.AND,
                          groups: [
                            {
                              logicOperator: LOGIC_OPERATORS.AND,
                              filters: [],
                            },
                          ],
                        };
                        setColumnFilters(emptyFilters);
                        if (onFiltersChange) {
                          onFiltersChange(emptyFilters);
                        }
                      }}
                      className="px-3 py-1.5 text-xs text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
                {filterGroups.length > 1 && (
                  <div className="flex items-center gap-2 pl-2 border-l border-border dark:border-border-dark">
                    <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap">{customViewsT('betweenGroups')}</span>
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
                  className="px-3 py-1.5 text-xs text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors whitespace-nowrap"
                >
                  + {customViewsT('addGroup')}
                </button>
              </div>
          </div>
        )}
      </div>

      {/* Filters Content */}
      {isExpanded && (
        <div className="pt-4 space-y-4">
          {/* Filter Groups */}
          {filterGroups.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 italic">
                {customViewsT('noFilters')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filterGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="relative">
                  {groupIndex > 0 && (
                    <div className="absolute left-0 right-0 -top-4 flex items-center justify-center z-10">
                      <div className="px-3 py-1 text-xs font-medium text-primary-text/70 dark:text-primary-text-dark/70 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-full shadow-sm">
                        {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND ? automationRulesT('logicOperators.and') : automationRulesT('logicOperators.or')}
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
                  />
                </div>
              ))}
            </div>
          )}

          {/* Save/Update View */}
          {apiKey && hasActiveFilters && (
            <div className="pt-3 mt-3 border-t border-border dark:border-border-dark">
              <div className="flex flex-col gap-2 sm:gap-3">
                {!showSaveInput ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    {activeView && (
                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-primary-text dark:text-primary-text-dark flex-wrap">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveSort}
                            onChange={(e) => setSaveSort(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark focus:ring-accent dark:focus:ring-accent-dark"
                          />
                          <span className="whitespace-nowrap">{customViewsT('includeSort')}</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={saveColumns}
                            onChange={(e) => setSaveColumns(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark focus:ring-accent dark:focus:ring-accent-dark"
                          />
                          <span className="whitespace-nowrap">{customViewsT('includeColumns')}</span>
                        </label>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      {activeView && (
                        <button
                          type="button"
                          onClick={handleUpdateView}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-1 sm:flex-initial"
                        >
                          {isSaving ? customViewsT('updating') : customViewsT('updateView')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSaveInput(true)}
                        className="px-3 py-1.5 text-xs font-medium text-accent dark:text-accent-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded-md border border-accent dark:border-accent-dark transition-colors flex-1 sm:flex-initial"
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
                        className="flex-1 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveAsView();
                          } else if (e.key === 'Escape') {
                            setShowSaveInput(false);
                            setSaveViewName('');
                            // Restore checkbox states based on activeView if it exists
                            if (activeView) {
                              setSaveSort(!!activeView.sort_field);
                              setSaveColumns(!!activeView.visible_columns);
                            } else {
                              setSaveSort(false);
                              setSaveColumns(false);
                            }
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveAsView}
                        disabled={isSaving || !saveViewName.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isSaving ? customViewsT('saving') : customViewsT('save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSaveInput(false);
                          setSaveViewName('');
                          // Restore checkbox states based on activeView if it exists
                          if (activeView) {
                            setSaveSort(!!activeView.sort_field);
                            setSaveColumns(!!activeView.visible_columns);
                          } else {
                            setSaveSort(false);
                            setSaveColumns(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors"
                      >
                        {customViewsT('cancel')}
                      </button>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4 text-xs text-primary-text dark:text-primary-text-dark flex-wrap">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveSort}
                          onChange={(e) => setSaveSort(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark focus:ring-accent dark:focus:ring-accent-dark"
                        />
                        <span className="whitespace-nowrap">{customViewsT('includeSort')}</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveColumns}
                          onChange={(e) => setSaveColumns(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-border dark:border-border-dark text-accent dark:text-accent-dark focus:ring-accent dark:focus:ring-accent-dark"
                        />
                        <span className="whitespace-nowrap">{customViewsT('includeColumns')}</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tag Manager Modal */}
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        apiKey={apiKey}
      />
    </div>
  );
}
