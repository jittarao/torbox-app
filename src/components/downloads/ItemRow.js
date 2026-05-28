'use client';

import { memo } from 'react';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import DownloadProgressDisplay from './DownloadProgressDisplay';
import ItemActions from './ItemActions';
import Tooltip from '@/components/shared/Tooltip';
import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';
import TagDisplay from './Tags/TagDisplay';
import {
  getTableRowSurfaceClasses,
  tableActionsCell,
  tableActionsCellInner,
  tableCheckboxCell,
  tableDataCellPad,
  tableDataCellText,
} from './utils/responsiveLayout';
import { getResolvedColumnStyle } from './utils/tableColumnLayout';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';

function ItemRow({
  item,
  activeColumns,
  resolvedColumnWidths,
  selectedItems,
  setSelectedItems,
  handleItemSelection,
  setItems,
  downloadHistory,
  downloadHistoryLookup,
  onRowSelect,
  expandedItems,
  toggleFiles,
  apiKey,
  onDelete,
  rowIndex,
  setToast,
  activeType = 'torrents',
  isMobile = false,
  isBlurred = false,
  viewMode = 'table',
  style,
  measureRef,
  dataIndex,
}) {
  const commonT = useTranslations('Common');

  const renderCell = (columnId) => {
    const baseStyle = getResolvedColumnStyle(columnId, resolvedColumnWidths, { isMobile });

    switch (columnId) {
      case 'name':
        return (
          <td
            key={columnId}
            className={`${tableDataCellPad} relative overflow-hidden`}
            style={baseStyle}
          >
            <div
              className={`text-sm md:text-xs lg:text-sm text-primary-text dark:text-primary-text-dark min-w-0 cursor-pointer ${isBlurred ? 'blur-[6px] select-none' : ''}`}
            >
              <div
                className={`flex gap-2 min-w-0 ${isMobile ? 'items-start flex-wrap' : 'items-center'}`}
              >
                <Tooltip content={item.cached ? 'Cached' : 'Not cached'}>
                  <span
                    className={`inline-block shrink-0 size-2 rounded-full ${
                      item.cached
                        ? 'bg-label-success-text-dark dark:bg-label-success-text-dark'
                        : 'bg-label-danger-text-dark dark:bg-label-danger-text-dark'
                    }`}
                  ></span>
                </Tooltip>
                {item.private && (
                  <Tooltip content="Private Tracker">
                    <Icons.Private className="size-4 shrink-0 text-orange-500 dark:text-orange-400" />
                  </Tooltip>
                )}
                {item.name && (
                  <Tooltip content={!isBlurred ? item.name : ''}>
                    <span className={isMobile ? 'break-words min-w-0' : 'truncate'}>
                      {item.name || 'Unnamed Item'}
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
            {/* Show additional info on mobile */}
            {isMobile && (
              <div className="flex flex-col mt-1 text-xs text-primary-text/60 dark:text-primary-text-dark/60 gap-2">
                <div className="flex flex-col items-start gap-2">
                  {item.download_state && <DownloadStateBadge item={item} size="xs" />}
                  {item.active && !item.download_finished && (
                    <div className="w-full min-w-0">
                      <DownloadProgressDisplay item={item} variant="compact" />
                    </div>
                  )}
                  {(!item.active || item.download_finished) && (
                    <>
                      <span>{formatSize(item.size || 0)}</span>
                      {item.created_at && <span>{timeAgo(item.created_at, commonT)}</span>}
                    </>
                  )}
                </div>
              </div>
            )}
          </td>
        );
      case 'size':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {formatSize(item.size || 0)}
          </td>
        );
      case 'created_at':
      case 'cached_at':
      case 'updated_at':
      case 'expires_at':
        return (
          <td key={columnId} className={`${tableDataCellText} relative group`} style={baseStyle}>
            <div className="cursor-default">
              {item[columnId] ? (
                <>
                  <Tooltip content={formatDate(item[columnId])}>
                    <span>{timeAgo(item[columnId], commonT)}</span>
                  </Tooltip>
                </>
              ) : (
                'Unknown'
              )}
            </div>
          </td>
        );
      case 'download_state':
        return (
          <td key={columnId} className={`${tableDataCellPad} whitespace-nowrap`} style={baseStyle}>
            <DownloadStateBadge item={item} />
          </td>
        );
      case 'progress':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            <div className="w-full bg-progress-track dark:bg-progress-track-dark rounded-full h-2.5">
              <div
                className="bg-accent dark:bg-accent-dark h-2.5 rounded-full"
                style={{ width: `${(item.progress || 0) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs">{((item.progress || 0) * 100).toFixed(1)}%</span>
          </td>
        );
      case 'download_progress':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            <DownloadProgressDisplay item={item} variant="full" />
          </td>
        );
      case 'ratio':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {(item.ratio || 0).toFixed(2)}
          </td>
        );
      case 'download_speed':
      case 'upload_speed':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {formatSpeed(item[columnId])}
          </td>
        );
      case 'eta':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {formatEta(item.eta, commonT)}
          </td>
        );
      case 'id':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {item.id}
          </td>
        );
      case 'total_uploaded':
      case 'total_downloaded':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {formatSize(item[columnId] || 0)}
          </td>
        );
      case 'seeds':
      case 'peers':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {item[columnId] || 0}
          </td>
        );
      case 'file_count':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {item.files?.length || 0}
          </td>
        );
      case 'asset_type':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            <div className="flex items-center gap-2">
              <span
                className={`inline-block size-2 rounded-full ${
                  item.assetType === 'torrents'
                    ? 'bg-label-active-text dark:bg-label-active-text-dark'
                    : item.assetType === 'usenet'
                      ? 'bg-label-success-text dark:bg-label-success-text-dark'
                      : item.assetType === 'webdl'
                        ? 'bg-accent dark:bg-accent-dark'
                        : 'bg-label-default-text dark:bg-label-default-text-dark'
                }`}
              ></span>
              <span className="capitalize">
                {item.assetType === 'torrents'
                  ? 'Torrent'
                  : item.assetType === 'usenet'
                    ? 'Usenet'
                    : item.assetType === 'webdl'
                      ? 'Web'
                      : 'Unknown'}
              </span>
            </div>
          </td>
        );
      case 'private':
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {item.private ? (
              <div className="flex items-center gap-2">
                <Icons.Private className="size-4 text-orange-500 dark:text-orange-400" />
                <span>Private</span>
              </div>
            ) : (
              <span>Public</span>
            )}
          </td>
        );
      case 'error':
        return (
          <td
            key={columnId}
            className={`${tableDataCellPad} whitespace-nowrap text-sm md:text-xs lg:text-sm text-red-500`}
            style={baseStyle}
          >
            {item.error || ''}
          </td>
        );
      case 'tags':
        return (
          <td
            key={columnId}
            className={`${tableDataCellPad} text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
            style={baseStyle}
          >
            {item.tags && item.tags.length > 0 ? (
              <TagDisplay tags={item.tags} />
            ) : (
              <span className="text-primary-text/40 dark:text-primary-text-dark/40">-</span>
            )}
          </td>
        );
      default:
        return (
          <td key={columnId} className={tableDataCellText} style={baseStyle}>
            {item[columnId]}
          </td>
        );
    }
  };

  // For mobile, we'll only show the name column
  const visibleColumns = isMobile ? ['name'] : activeColumns;

  const isDownloaded = downloadHistoryLookup.itemDownloads.has(
    `${item.assetType}:${String(item.id)}`
  );

  const selectionId = getDownloadSelectionId(item);
  const isSelected = selectedItems.items?.has(selectionId);
  const { row: rowSurfaceClass, stickyCell: actionsSurfaceClass } = getTableRowSurfaceClasses({
    selected: isSelected,
    downloaded: isDownloaded,
  });

  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={`${rowSurfaceClass} ${!onRowSelect(selectionId, selectedItems.files) && 'cursor-pointer'}`}
      style={style}
      onMouseDown={(e) => {
        // Prevent text selection on shift+click
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        // Ignore clicks on buttons or if has selected files
        if (e.target.closest('button') || onRowSelect(selectionId, selectedItems.files)) return;
        const isChecked = selectedItems.items?.has(selectionId);
        handleItemSelection(selectionId, !isChecked, rowIndex, e.shiftKey);
      }}
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !e.target.closest('button') &&
          !onRowSelect(selectionId, selectedItems.files)
        ) {
          e.preventDefault();
          const isChecked = selectedItems.items?.has(selectionId);
          handleItemSelection(selectionId, !isChecked, rowIndex, e.shiftKey);
        }
      }}
      tabIndex={0}
    >
      <td className={tableCheckboxCell}>
        <input
          type="checkbox"
          checked={selectedItems.items?.has(selectionId)}
          disabled={onRowSelect(selectionId, selectedItems.files)}
          onChange={(e) => handleItemSelection(selectionId, e.target.checked, rowIndex, e.shiftKey)}
          style={{ pointerEvents: 'none' }}
          className="accent-accent dark:accent-accent-dark"
        />
      </td>
      {visibleColumns.map((columnId) => renderCell(columnId))}
      <td className={`${tableActionsCell} ${actionsSurfaceClass}`}>
        <div className={tableActionsCellInner}>
          <ItemActions
            item={item}
            apiKey={apiKey}
            onDelete={onDelete}
            toggleFiles={toggleFiles}
            expandedItems={expandedItems}
            setItems={setItems}
            setSelectedItems={setSelectedItems}
            setToast={setToast}
            activeType={activeType}
            downloadHistory={downloadHistory}
          />
        </div>
      </td>
    </tr>
  );
}

export default memo(ItemRow);
