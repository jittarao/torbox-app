'use client';

import { memo } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import ItemActions from './ItemActions';
import {
  getTableRowSurfaceClasses,
  tableRowFocusClasses,
  tableActionsCell,
  tableActionsCellInner,
  tableCheckboxCell,
} from './utils/responsiveLayout';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import {
  useIsDownloadSelected,
  useItemHasSelectedFiles,
} from '@/components/shared/hooks/useSelection';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import ItemRowCell from './ItemRowCell';

function ItemRow({
  item,
  activeColumns,
  resolvedColumnStyles = {},
  handleItemSelection,
  downloadHistoryLookup,
  toggleFiles,
  apiKey,
  onDelete,
  rowIndex,
  setToast,
  activeType = 'torrents',
  isBlurred = false,
  viewMode = 'table',
  style,
  rowContentVisibility,
  measureRef,
  dataIndex,
  commonT,
}) {
  const isMobile = useIsMobile();
  const isExpanded = useDownloadsUiStore((s) => Boolean(s.expandedById[item.id]));

  // For mobile, we'll only show the name column
  const visibleColumns = isMobile ? ['name'] : activeColumns;

  const itemKey = `${item.assetType}:${String(item.id)}`;
  const isDownloaded = downloadHistoryLookup.itemDownloads.has(itemKey);
  const isLinkFailed = downloadHistoryLookup.itemLinkFailed?.has(itemKey);

  const selectionId = getDownloadSelectionId(item);
  const isSelected = useIsDownloadSelected(selectionId);
  const hasSelectedFiles = useItemHasSelectedFiles(selectionId);
  const { row: rowSurfaceClass, stickyCell: actionsSurfaceClass } = getTableRowSurfaceClasses({
    selected: isSelected,
    downloaded: isDownloaded,
    linkFailed: isLinkFailed,
  });

  const filesRegionId = `files-${selectionId}`;

  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      aria-selected={isSelected}
      id={isExpanded ? filesRegionId : undefined}
      className={`${rowSurfaceClass} ${tableRowFocusClasses} ${!hasSelectedFiles && 'cursor-pointer'}`}
      style={rowContentVisibility ? { ...style, ...rowContentVisibility } : style}
      tabIndex={0}
      onMouseDown={(e) => {
        // Prevent text selection on shift+click
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        // Ignore clicks on buttons or if has selected files
        if (e.target.closest('button') || hasSelectedFiles) return;
        handleItemSelection(selectionId, !isSelected, rowIndex, e.shiftKey);
        // Mouse selection (incl. shift+range) must not leave a focus ring on the row
        e.currentTarget.blur();
      }}
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !e.target.closest('button') &&
          !hasSelectedFiles
        ) {
          e.preventDefault();
          handleItemSelection(selectionId, !isSelected, rowIndex, e.shiftKey);
        }
      }}
    >
      <td className={tableCheckboxCell}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={hasSelectedFiles}
          aria-label={commonT('selectRow', { name: item.name || item.id })}
          onChange={(e) => handleItemSelection(selectionId, e.target.checked, rowIndex, e.shiftKey)}
          style={{ pointerEvents: 'none' }}
          className="accent-accent dark:accent-accent-dark"
        />
      </td>
      {visibleColumns.map((columnId) => {
        const baseStyle = resolvedColumnStyles[columnId] ?? {};
        return (
          <ItemRowCell
            key={columnId}
            item={item}
            columnId={columnId}
            style={baseStyle}
            isBlurred={isBlurred}
            isMobile={isMobile}
            commonT={commonT}
          />
        );
      })}
      <td className={`${tableActionsCell} ${actionsSurfaceClass}`}>
        <div className={tableActionsCellInner}>
          <ItemActions
            item={item}
            apiKey={apiKey}
            onDelete={onDelete}
            toggleFiles={toggleFiles}
            isExpanded={isExpanded}
            setToast={setToast}
            activeType={activeType}
          />
        </div>
      </td>
    </tr>
  );
}

export default memo(ItemRow);
