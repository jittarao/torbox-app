'use client';

import { useState } from 'react';
import FilterInput from './FilterInput';
import { LOGIC_OPERATORS } from '../../AutomationRules/constants';
import Select from '@/components/shared/Select';

export default function FilterGroup({
  group,
  groupIndex,
  totalGroups,
  onUpdateGroup,
  onRemoveGroup,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  availableColumns,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleLogicChange = (newLogic) => {
    onUpdateGroup(groupIndex, 'logicOperator', newLogic);
  };

  const handleAddFilter = () => {
    onAddFilter(groupIndex);
  };

  const hasFilters = group.filters && group.filters.length > 0;

  return (
    <div className="border border-border dark:border-border-dark rounded-md bg-surface-alt dark:bg-surface-alt-dark">
      {/* Group Header */}
      <div className="flex items-center justify-between p-2 border-b border-border dark:border-border-dark">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Group {groupIndex + 1}
          </button>

          {hasFilters && (
            <Select
              value={group.logicOperator || LOGIC_OPERATORS.AND}
              onChange={(e) => handleLogicChange(e.target.value)}
              className="min-w-[80px] text-xs"
            >
              <option value={LOGIC_OPERATORS.AND}>AND</option>
              <option value={LOGIC_OPERATORS.OR}>OR</option>
            </Select>
          )}

          {hasFilters && (
            <span className="text-xs text-primary-text/50 dark:text-primary-text-dark/50">
              ({group.filters.length} filter{group.filters.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isExpanded && (
            <button
              type="button"
              onClick={handleAddFilter}
              className="px-2 py-1 text-xs text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark rounded transition-colors"
              title="Add filter to group"
            >
              + Filter
            </button>
          )}

          {totalGroups > 1 && (
            <button
              type="button"
              onClick={() => onRemoveGroup(groupIndex)}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors"
              title="Remove group"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      {isExpanded && (
        <div className="p-2 space-y-2">
          {!hasFilters ? (
            <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 italic py-2">
              No filters in this group. Click "+ Filter" to add one.
            </p>
          ) : (
            <>
              {group.filters.map((filter, filterIndex) => (
                <div key={filterIndex} className="relative">
                  {filterIndex > 0 && (
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border dark:bg-border-dark -translate-y-2" />
                  )}
                  {filterIndex > 0 && (
                    <div className="absolute left-4 -top-2 text-xs text-primary-text/50 dark:text-primary-text-dark/50 bg-surface-alt dark:bg-surface-alt-dark px-1">
                      {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND ? 'AND' : 'OR'}
                    </div>
                  )}
                  <FilterInput
                    filter={filter}
                    index={filterIndex}
                    totalFilters={group.filters.length}
                    onUpdate={(idx, field, val) => onUpdateFilter(groupIndex, idx, field, val)}
                    onRemove={(idx) => onRemoveFilter(groupIndex, idx)}
                    availableColumns={availableColumns}
                  />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
