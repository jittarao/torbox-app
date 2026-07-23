import { useId } from 'react';
import { AdminCard, AdminFilterChip, adminInputClass } from './AdminUi';

export default function UserListToolbar({
  searchValue,
  onSearchValueChange,
  onSearchSubmit,
  filters,
  onStatusFilter,
  onActivityFilter,
  reactivating,
  onReactivateAllInactive,
}) {
  const searchInputId = useId();

  return (
    <AdminCard bodyClassName="!py-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <form onSubmit={onSearchSubmit} className="min-w-0 flex-1">
          <label htmlFor={searchInputId} className="sr-only">
            Search users by auth ID or key name
          </label>
          <input
            id={searchInputId}
            type="search"
            placeholder="Search by auth ID or key name…"
            value={searchValue}
            onChange={(e) => onSearchValueChange(e.target.value)}
            className={adminInputClass}
          />
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <AdminFilterChip active={!filters?.status} onClick={() => onStatusFilter('all')}>
            All
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.status === 'active'}
            onClick={() => onStatusFilter('active')}
          >
            Active
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.status === 'inactive'}
            onClick={() => onStatusFilter('inactive')}
          >
            Inactive
          </AdminFilterChip>
          <button
            type="button"
            onClick={onReactivateAllInactive}
            disabled={reactivating}
            className="ui-btn-accent shrink-0 disabled:opacity-50"
            title="Set all inactive API keys to active"
          >
            {reactivating ? 'Reactivating…' : 'Reactivate inactive'}
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 dark:border-border-dark/40">
        <span className="text-xs font-medium uppercase tracking-wide text-muted dark:text-muted-dark">
          Activity
        </span>
        <AdminFilterChip active={!filters?.activity} onClick={() => onActivityFilter?.('all')}>
          All
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'online'}
          onClick={() => onActivityFilter?.('online')}
        >
          Online
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'today'}
          onClick={() => onActivityFilter?.('today')}
        >
          Active today
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'week'}
          onClick={() => onActivityFilter?.('week')}
        >
          Active this week
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'month'}
          onClick={() => onActivityFilter?.('month')}
        >
          Active this month
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'inactive30d'}
          onClick={() => onActivityFilter?.('inactive30d')}
        >
          Inactive &gt;30d
        </AdminFilterChip>
        <AdminFilterChip
          active={filters?.activity === 'dormant'}
          onClick={() => onActivityFilter?.('dormant')}
        >
          Dormant &gt;90d
        </AdminFilterChip>
      </div>
    </AdminCard>
  );
}
