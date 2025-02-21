'use client';
import { COLUMNS } from './constants';

export default function TableHeader({ 
  activeColumns, 
  selectedItems, 
  onSelectAll, 
  torrents,
  sortField,
  sortDirection,
  onSort 
}) {
  return (
    <thead className="bg-surface-alt dark:bg-surface-alt-dark">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider">
          <input
            type="checkbox"
            onChange={(e) => onSelectAll(torrents, e.target.checked)}
            checked={selectedItems.torrents.size === torrents.length && torrents.length > 0}
            className="rounded border-border dark:border-border-dark text-accent dark:text-accent-dark focus:ring-accent/20"
          />
        </th>
        {activeColumns.map(columnId => {
          const column = COLUMNS[columnId];
          return (
            <th
              key={columnId}
              onClick={() => column.sortable && onSort(columnId)}
              className={`px-6 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider ${
                column.sortable ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors' : ''
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
        <th className="px-6 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
  );
} 