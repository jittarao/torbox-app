'use client';

import { memo, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
import { useDownloadsSelectionStore } from '@/store/downloadsSelectionStore';

function TableHeader({
  activeColumns,
  resolvedColumnWidths,
  updateColumnWidth,
  onSelectAll,
  items,
  sortField,
  sortDirection,
  onSort,
}) {
  const selectedItems = useDownloadsSelectionStore(useShallow((s) => s.selectedItems));
  const columnT = useTranslations('Columns');
  const commonT = useTranslations('Common');
  const isMobile = useIsMobile();

  const visibleColumns = isMobile ? ['name'] : activeColumns;

  const handleSortColumn = useCallback(
    (columnId) => {
      onSort(columnId);
    },
    [onSort]
  );

  const handleWidthChange = useCallback(
    (columnId, width) => {
      updateColumnWidth(columnId, width);
    },
    [updateColumnWidth]
  );

  return (
    <thead className="bg-surface-alt dark:bg-surface-alt-dark">
      <tr className="table-row bg-surface-alt dark:bg-surface-alt-dark">
        <th className={tableHeaderCheckboxCell}>
          <input
            type="checkbox"
            onChange={(e) => onSelectAll(items, e.target.checked)}
            aria-label={commonT('selectAll')}
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
              onWidthChange={(width) => handleWidthChange(columnId, width)}
              sortable={column.sortable}
              onClick={() => column.sortable && handleSortColumn(columnId)}
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

export default memo(TableHeader);
