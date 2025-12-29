'use client';

import { COLUMNS } from '@/components/constants';
import useIsMobile from '@/hooks/useIsMobile';
import ResizableColumn from './ResizableColumn';
import { useTranslations } from 'next-intl';

export default function TableHeader({
  activeColumns,
  columnWidths,
  updateColumnWidth,
  selectedItems,
  onSelectAll,
  items,
  sortField,
  sortDirection,
  onSort,
}) {
  const columnT = useTranslations('Columns');
  const isMobile = useIsMobile();

  // For mobile, we'll only show the name column and actions
  const visibleColumns = isMobile ? ['name'] : activeColumns;

  return (
    <thead className="bg-surface-alt dark:bg-surface-alt-dark">
      <tr className="table-row">
        <th className="px-2 md:px-4 py-3 text-center text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase w-[48px] min-w-[48px] max-w-[48px] md:w-[60px] md:min-w-[60px] md:max-w-[60px]">
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
            <ResizableColumn
              key={columnId}
              columnId={columnId}
              width={columnWidths[columnId]}
              onWidthChange={(width) => updateColumnWidth(columnId, width)}
              sortable={column.sortable}
              onClick={() => column.sortable && onSort(columnId)}
              className={`px-2 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase ${
                column.sortable
                  ? 'cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors'
                  : ''
              }`}
            >
              {column.displayName ? column.displayName : columnT(column.key)}
              {sortField === columnId && (
                <span className="ml-1 text-accent dark:text-accent-dark">
                  {sortDirection === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </ResizableColumn>
          );
        })}
        <th className="px-2 md:px-4 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase sticky right-0 bg-surface-alt dark:bg-surface-alt-dark w-[100px] min-w-[100px] max-w-[100px]">
          {columnT('actions')}
        </th>
      </tr>
    </thead>
  );
}
