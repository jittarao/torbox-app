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
    <thead className="bg-gray-50 dark:bg-gray-800">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <input
            type="checkbox"
            onChange={(e) => onSelectAll(torrents, e.target.checked)}
            checked={selectedItems.torrents.size === torrents.length && torrents.length > 0}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
        </th>
        {activeColumns.map(columnId => {
          const column = COLUMNS[columnId];
          return (
            <th
              key={columnId}
              onClick={() => column.sortable && onSort(columnId)}
              className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                column.sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''
              }`}
            >
              {column.label}
              {sortField === columnId && (
                <span className="ml-1">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </th>
          );
        })}
        <th className="px-6 py-3 text-left text-xs text-right font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
  );
} 