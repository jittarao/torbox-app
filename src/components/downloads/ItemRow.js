'use client';

import { memo } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import DownloadProgressDisplay from './DownloadProgressDisplay';
import ItemActions from './ItemActions';
import Tooltip from '@/components/shared/Tooltip';
import { Private } from '@/components/icons';
import TagDisplay from './Tags/TagDisplay';
import {
  getTableRowSurfaceClasses,
  tableRowFocusClasses,
  tableActionsCell,
  tableActionsCellInner,
  tableCheckboxCell,
  tableDataCellPad,
  tableDataCellText,
} from './utils/responsiveLayout';
import { getResolvedColumnStyle } from './utils/tableColumnLayout';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import {
  useIsDownloadSelected,
  useItemHasSelectedFiles,
} from '@/components/shared/hooks/useSelection';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';

function NameCell({ item, isBlurred, isMobile, style, commonT }) {
  return (
    <td className={`${tableDataCellPad} relative overflow-hidden`} style={style}>
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
              <Private className="size-4 shrink-0 text-orange-500 dark:text-orange-400" />
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
}
const NameCellMemo = memo(NameCell);

function SizeCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {formatSize(item.size || 0)}
    </td>
  );
}
const SizeCellMemo = memo(SizeCell);

function DateCell({ item, columnId, style, commonT }) {
  return (
    <td className={`${tableDataCellText} relative group`} style={style}>
      <div className="cursor-default">
        {item[columnId] ? (
          <Tooltip content={formatDate(item[columnId])}>
            <span>{timeAgo(item[columnId], commonT)}</span>
          </Tooltip>
        ) : (
          'Unknown'
        )}
      </div>
    </td>
  );
}
const DateCellMemo = memo(DateCell);

function StateCell({ item, style }) {
  return (
    <td className={`${tableDataCellPad} whitespace-nowrap`} style={style}>
      <DownloadStateBadge item={item} />
    </td>
  );
}
const StateCellMemo = memo(StateCell);

function ProgressCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      <div className="w-full bg-progress-track dark:bg-progress-track-dark rounded-full h-2.5">
        <div
          className="bg-accent dark:bg-accent-dark h-2.5 rounded-full"
          style={{ width: `${(item.progress || 0) * 100}%` }}
        ></div>
      </div>
      <span className="text-xs">{((item.progress || 0) * 100).toFixed(1)}%</span>
    </td>
  );
}
const ProgressCellMemo = memo(ProgressCell);

function DownloadProgressCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      <DownloadProgressDisplay item={item} variant="full" />
    </td>
  );
}
const DownloadProgressCellMemo = memo(DownloadProgressCell);

function RatioCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {(item.ratio || 0).toFixed(2)}
    </td>
  );
}
const RatioCellMemo = memo(RatioCell);

function SpeedCell({ item, columnId, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {formatSpeed(item[columnId])}
    </td>
  );
}
const SpeedCellMemo = memo(SpeedCell);

function EtaCell({ item, style, commonT }) {
  return (
    <td className={tableDataCellText} style={style}>
      {formatEta(item.eta, commonT)}
    </td>
  );
}
const EtaCellMemo = memo(EtaCell);

function IdCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {item.id}
    </td>
  );
}
const IdCellMemo = memo(IdCell);

function TransferSizeCell({ item, columnId, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {formatSize(item[columnId] || 0)}
    </td>
  );
}
const TransferSizeCellMemo = memo(TransferSizeCell);

function SeedsPeersCell({ item, columnId, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {item[columnId] || 0}
    </td>
  );
}
const SeedsPeersCellMemo = memo(SeedsPeersCell);

function FileCountCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {item.files?.length || 0}
    </td>
  );
}
const FileCountCellMemo = memo(FileCountCell);

function AssetTypeCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
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
}
const AssetTypeCellMemo = memo(AssetTypeCell);

function PrivateCell({ item, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {item.private ? (
        <div className="flex items-center gap-2">
          <Private className="size-4 text-orange-500 dark:text-orange-400" />
          <span>Private</span>
        </div>
      ) : (
        <span>Public</span>
      )}
    </td>
  );
}
const PrivateCellMemo = memo(PrivateCell);

function ErrorCell({ item, style }) {
  return (
    <td
      className={`${tableDataCellPad} whitespace-nowrap text-sm md:text-xs lg:text-sm text-red-500`}
      style={style}
    >
      {item.error || ''}
    </td>
  );
}
const ErrorCellMemo = memo(ErrorCell);

function TagsCell({ item, style }) {
  return (
    <td
      className={`${tableDataCellPad} text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
      style={style}
    >
      {item.tags && item.tags.length > 0 ? (
        <TagDisplay tags={item.tags} />
      ) : (
        <span className="text-primary-text/40 dark:text-primary-text-dark/40">-</span>
      )}
    </td>
  );
}
const TagsCellMemo = memo(TagsCell);

function DefaultCell({ item, columnId, style }) {
  return (
    <td className={tableDataCellText} style={style}>
      {item[columnId]}
    </td>
  );
}
const DefaultCellMemo = memo(DefaultCell);

const COLUMN_CELLS = {
  name: NameCellMemo,
  size: SizeCellMemo,
  created_at: DateCellMemo,
  cached_at: DateCellMemo,
  updated_at: DateCellMemo,
  expires_at: DateCellMemo,
  download_state: StateCellMemo,
  progress: ProgressCellMemo,
  download_progress: DownloadProgressCellMemo,
  ratio: RatioCellMemo,
  download_speed: SpeedCellMemo,
  upload_speed: SpeedCellMemo,
  eta: EtaCellMemo,
  id: IdCellMemo,
  total_uploaded: TransferSizeCellMemo,
  total_downloaded: TransferSizeCellMemo,
  seeds: SeedsPeersCellMemo,
  peers: SeedsPeersCellMemo,
  file_count: FileCountCellMemo,
  asset_type: AssetTypeCellMemo,
  private: PrivateCellMemo,
  error: ErrorCellMemo,
  tags: TagsCellMemo,
};

function ItemRow({
  item,
  activeColumns,
  resolvedColumnWidths,
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

  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={`${rowSurfaceClass} ${tableRowFocusClasses} ${!hasSelectedFiles && 'cursor-pointer'}`}
      style={style}
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
      tabIndex={0}
    >
      <td className={tableCheckboxCell}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={hasSelectedFiles}
          onChange={(e) => handleItemSelection(selectionId, e.target.checked, rowIndex, e.shiftKey)}
          style={{ pointerEvents: 'none' }}
          className="accent-accent dark:accent-accent-dark"
        />
      </td>
      {visibleColumns.map((columnId) => {
        const Cell = COLUMN_CELLS[columnId] || DefaultCellMemo;
        const baseStyle = getResolvedColumnStyle(columnId, resolvedColumnWidths, { isMobile });
        return (
          <Cell
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
