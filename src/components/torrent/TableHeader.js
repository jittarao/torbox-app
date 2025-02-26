'use client';
import { COLUMNS } from '@/components/constants';
import { useState, useEffect } from 'react';

export default function TableHeader({
  activeColumns,
  selectedItems,
  onSelectAll,
  items,
  sortField,
  sortDirection,
  onSort,
}) {
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on a mobile device
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

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
        <th className="px-3 md:px-6 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase tracking-wider sticky right-0 bg-surface-alt dark:bg-surface-alt-dark z-10 shadow-[-8px_0_10px_-5px_rgba(0,0,0,0.1)]">
          Actions
        </th>
      </tr>
    </thead>
  );
}
