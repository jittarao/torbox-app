'use client';

import { Fragment, useState } from 'react';
import FilterInput from './FilterInput';
import { LOGIC_OPERATORS } from '../../AutomationRules/constants';
import Select from '@/components/shared/Select';
import { useTranslations } from 'next-intl';

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
  apiKey,
  activeType = 'all',
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const customViewsT = useTranslations('CustomViews');
  const automationRulesT = useTranslations('AutomationRules');

  const handleLogicChange = (newLogic) => {
    onUpdateGroup(groupIndex, 'logicOperator', newLogic);
  };

  const handleAddFilter = () => {
    onAddFilter(groupIndex);
  };

  const hasFilters = group.filters && group.filters.length > 0;
  const hasMultipleFilters = hasFilters && group.filters.length > 1;

  return (
    <div className="border border-border dark:border-border-dark rounded-md bg-surface-alt dark:bg-surface-alt-dark">
      {/* Group Header */}
      <div className="flex flex-col gap-2 p-2 border-b border-border dark:border-border-dark sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
              <option value={LOGIC_OPERATORS.AND}>{automationRulesT('logicOperators.and')}</option>
              <option value={LOGIC_OPERATORS.OR}>{automationRulesT('logicOperators.or')}</option>
            </Select>
          )}

          {hasFilters && (
            <span className="text-xs text-primary-text/50 dark:text-primary-text-dark/50">
              ({group.filters.length} filter{group.filters.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
          {isExpanded && (
            <button
              type="button"
              onClick={handleAddFilter}
              className="whitespace-nowrap px-2 py-1 text-xs text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark rounded transition-colors"
              title={customViewsT('addFilterToGroup')}
            >
              + {customViewsT('addFilter')}
            </button>
          )}

          {totalGroups > 1 && (
            <button
              type="button"
              onClick={() => onRemoveGroup(groupIndex)}
              className="px-2 py-1 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded transition-colors"
              title={customViewsT('removeGroup')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Group Content */}
      {isExpanded && (
        <div className={`p-2 space-y-2 ${hasMultipleFilters ? 'pl-3' : ''}`}>
          {!hasFilters ? (
            <p className="text-xs text-primary-text/70 dark:text-primary-text-dark/70 italic py-2">
              {customViewsT('noFiltersInGroup')}
            </p>
          ) : (
            <>
              {group.filters.map((filter, filterIndex) => (
                <Fragment key={filter._key || filterIndex}>
                  {filterIndex > 0 && (
                    <div className="relative h-4" aria-hidden>
                      <div className="absolute inset-y-0 left-0 z-10 flex -translate-x-1/2 items-center">
                        <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-border/60 bg-surface-alt px-2 text-[10px] font-semibold uppercase leading-none tracking-wide text-primary-text/55 shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark dark:text-primary-text-dark/55">
                          {(group.logicOperator || LOGIC_OPERATORS.AND) === LOGIC_OPERATORS.AND
                            ? automationRulesT('logicOperators.and')
                            : automationRulesT('logicOperators.or')}
                        </span>
                      </div>
                    </div>
                  )}
                  <FilterInput
                    filter={filter}
                    index={filterIndex}
                    totalFilters={group.filters.length}
                    onUpdate={(idx, field, val) => onUpdateFilter(groupIndex, idx, field, val)}
                    onRemove={(idx) => onRemoveFilter(groupIndex, idx)}
                    availableColumns={availableColumns}
                    apiKey={apiKey}
                    activeType={activeType}
                  />
                </Fragment>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
