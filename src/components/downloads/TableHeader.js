'use client';

import { COLUMNS } from '@/components/constants';
import useIsMobile from '@/hooks/useIsMobile';
import ResizableColumn from './ResizableColumn';
import { useTranslations } from 'next-intl';
import {
  tableHeaderActionsCell,
  tableHeaderCell,
  tableHeaderCheckboxCell,
} from './utils/responsiveLayout';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

export default function TableHeader({
  activeColumns,
  resolvedColumnWidths,
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
      <tr className="table-row bg-surface-alt dark:bg-surface-alt-dark">
        <th className={tableHeaderCheckboxCell}>
          <input
            type="checkbox"
            onChange={(e) => onSelectAll(items, e.target.checked)}
            checked={
              items.length > 0 &&
              items.every((item) => selectedItems.items?.has(getDownloadSelectionId(item)))
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
              width={resolvedColumnWidths[columnId]}
              onWidthChange={(width) => updateColumnWidth(columnId, width)}
              sortable={column.sortable}
              onClick={() => column.sortable && onSort(columnId)}
              className={`${tableHeaderCell} ${
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
        <th className={tableHeaderActionsCell}>{columnT('actions')}</th>
      </tr>
    </thead>
  );
}
