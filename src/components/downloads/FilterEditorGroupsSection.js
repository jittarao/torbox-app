'use client';

import FilterGroup from './CustomViews/components/FilterGroup';
import { LOGIC_OPERATORS } from './AutomationRules/constants';
import Select from '@/components/shared/Select';
import { Filter, Plus } from '@/components/icons';

export default function FilterEditorGroupsSection({
  filterGroups,
  groupLogicOperator,
  customViewsT,
  automationRulesT,
  handleGroupLogicChange,
  handleAddGroup,
  handleUpdateGroup,
  handleRemoveGroup,
  handleAddFilter,
  handleUpdateFilter,
  handleRemoveFilter,
  availableColumns,
  apiKey,
  activeType,
}) {
  const addGroupLink = (
    <button
      type="button"
      onClick={handleAddGroup}
      className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent/80 dark:text-accent-dark dark:hover:text-accent-dark/80"
    >
      <Plus className="size-3.5" aria-hidden />
      {customViewsT('addGroup')}
    </button>
  );

  return (
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
              <option value={LOGIC_OPERATORS.AND}>{automationRulesT('logicOperators.and')}</option>
              <option value={LOGIC_OPERATORS.OR}>{automationRulesT('logicOperators.or')}</option>
            </Select>
          </div>
        )}
      </div>

      {filterGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-10 text-center dark:border-border-dark/60">
          <Filter
            className="mb-2 size-8 text-primary-text/25 dark:text-primary-text-dark/25"
            aria-hidden
          />
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
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">{addGroupLink}</div>
    </div>
  );
}
