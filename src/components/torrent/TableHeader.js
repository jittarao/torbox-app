'use client';

import { COLUMNS } from '@/components/constants';
import useIsMobile from '@/hooks/useIsMobile';

export default function TableHeader({
  activeColumns,
  selectedItems,
  onSelectAll,
  items,
  sortField,
  sortDirection,
  onSort,
}) {
  const isMobile = useIsMobile();

  // For mobile, we'll only show the name column and actions
  const visibleColumns = isMobile ? ['name'] : activeColumns;

  return (
    <thead className="bg-surface-alt dark:bg-surface-alt-dark">
      <tr>
        <th className="px-3 md:px-6 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider">
          <input
            type="checkbox"
            onChange={(e) => onSelectAll(items, e.target.checked)}
            checked={
              selectedItems.items?.size === items.length && items.length > 0
            }
            className="accent-accent dark:accent-accent-dark"
          />
        </th>
        {visibleColumns.map((columnId) => {
          const column = COLUMNS[columnId];
          return (
            <th
              key={columnId}
              onClick={() => column.sortable && onSort(columnId)}
              className={`px-3 md:px-6 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider ${
                column.sortable
                  ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors'
                  : ''
              }`}
            >
              {column.label}
              {sortField === columnId && (
                <span className="ml-1 text-accent dark:text-accent-dark">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
          );
        })}
        <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider sticky right-0 bg-surface-alt dark:bg-surface-alt-dark z-10">
          Actions
        </th>
      </tr>
    </thead>
  );
}
