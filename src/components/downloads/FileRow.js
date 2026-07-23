'use client';

import { memo } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import Copy from '@/components/icons/Copy';
import Download from '@/components/icons/Download';
import Play from '@/components/icons/Play';
import { TABLE_FILE_ROW_CONTENT_VISIBILITY } from './utils/tableConstants';
import { formatSize } from './utils/formatters';
import { getDisplayMimetype } from './utils/mimetypeDisplay';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';
import { isVideoFile, isAudioFile } from './utils/videoDetection';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import { resolveItemFiles } from '@/utils/downloadEntityFiles';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import {
  useIsFileSelected,
  useIsItemBlockingFileSelect,
} from '@/components/shared/hooks/useSelection';
import {
  selectIsFileDownloading,
  selectIsFileCopying,
  selectIsFileStreaming,
} from '@/store/fileInteractionStore';
import { useFileInteractionStore } from '@/store/fileInteractionStore';
import {
  getActionsColumnWidthPx,
  getCheckboxColumnWidthPx,
  getTableRowSurfaceClasses,
  tableActionsCell,
  tableActionsCellInner,
  tableCheckboxCell,
  tableRowSeparator,
} from './utils/responsiveLayout';

const EXTRA_COLUMN_PADDING = 10;

const FILE_ACTION_BUTTON_CLASS =
  'p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors touch-manipulation';

/** Fixed slot so copy/download stay column-aligned when play is absent */
const FILE_ACTION_SLOT_CLASS =
  'inline-flex size-9 sm:size-7 md:size-6 lg:size-7 shrink-0 items-center justify-center';

function stopRowActivation(e) {
  e.stopPropagation();
}

function FileRow({
  item,
  handleFileSelection,
  handleFileDownload,
  handleFileStream,
  handleAudioPlay,
  activeColumns,
  downloadHistoryLookup,
  isBlurred = false,
  tableWidth,
  file = null,
  fileIndex = null,
  measureRef,
  dataIndex,
  style,
}) {
  const t = useTranslations('FileActions');
  const commonT = useTranslations('Common');
  const isMobile = useIsMobile();
  const selectionId = getDownloadSelectionId(item);
  const isItemSelected = useIsItemBlockingFileSelect(selectionId);

  const filesToRender =
    file != null
      ? [file]
      : resolveItemFiles(item, useTorboxDownloadsStore.getState().filesByEntityKey).slice(
          fileIndex !== null ? fileIndex : 0,
          fileIndex !== null ? fileIndex + 1 : undefined
        );

  return (
    <>
      {filesToRender.map((file, index) => {
        const actualIndex = fileIndex !== null ? fileIndex : index;
        return (
          <FileRowInnerMemo
            key={`${selectionId}-${file.id}`}
            file={file}
            actualIndex={actualIndex}
            selectionId={selectionId}
            isItemSelected={isItemSelected}
            item={item}
            handleFileSelection={handleFileSelection}
            handleFileDownload={handleFileDownload}
            handleFileStream={handleFileStream}
            handleAudioPlay={handleAudioPlay}
            activeColumns={activeColumns}
            downloadHistoryLookup={downloadHistoryLookup}
            isBlurred={isBlurred}
            tableWidth={tableWidth}
            measureRef={measureRef}
            dataIndex={dataIndex}
            fileIndex={fileIndex}
            attachMeasureRef={fileIndex !== null}
            isMobile={isMobile}
            style={style}
            t={t}
          />
        );
      })}
    </>
  );
}

function FileRowInner({
  file,
  actualIndex,
  selectionId,
  isItemSelected,
  item,
  handleFileSelection,
  handleFileDownload,
  handleFileStream,
  handleAudioPlay,
  activeColumns,
  downloadHistoryLookup,
  isBlurred,
  tableWidth,
  measureRef,
  dataIndex,
  t,
  fileIndex,
  attachMeasureRef,
  isMobile,
  style,
}) {
  const isChecked = useIsFileSelected(selectionId, file.id);
  const isDisabled = isItemSelected;
  const itemKey = `${item.assetType}:${String(item.id)}`;
  const historyFileKey = `${itemKey}:${String(file.id)}`;
  const storeFileKey = `${String(item.id)}-${String(file.id)}`;
  const isFileDownloading = useFileInteractionStore(selectIsFileDownloading(storeFileKey));
  const isFileCopying = useFileInteractionStore(selectIsFileCopying(storeFileKey));
  const isFileStreaming = useFileInteractionStore(selectIsFileStreaming(storeFileKey));
  const isDownloaded =
    downloadHistoryLookup.itemDownloads.has(itemKey) ||
    downloadHistoryLookup.fileDownloads.has(historyFileKey);
  const isLinkFailed =
    downloadHistoryLookup.itemLinkFailed?.has(itemKey) ||
    downloadHistoryLookup.fileLinkFailed?.has(historyFileKey);

  const { row: rowSurfaceClass, stickyCell: actionsSurfaceClass } = getTableRowSurfaceClasses({
    selected: isChecked,
    downloaded: isDownloaded,
    linkFailed: isLinkFailed,
  });

  return (
    <tr
      ref={attachMeasureRef ? measureRef : undefined}
      data-index={attachMeasureRef ? dataIndex : undefined}
      className={`${rowSurfaceClass} transition-colors ${!isDisabled && 'cursor-pointer'}`}
      style={
        style
          ? { ...style, ...TABLE_FILE_ROW_CONTENT_VISIBILITY }
          : TABLE_FILE_ROW_CONTENT_VISIBILITY
      }
      onMouseDown={(e) => {
        // Prevent text selection on shift+click
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (e.target.closest('button, [data-file-actions]') || isDisabled) return;
        handleFileSelection(selectionId, actualIndex, file, !isChecked, e.shiftKey);
      }}
    >
      {/* Checkbox */}
      <td className={`${tableCheckboxCell} py-2 md:py-1.5 lg:py-2`}>
        <input
          type="checkbox"
          checked={isChecked}
          disabled={isDisabled}
          aria-label={commonT('selectRow', { name: file.short_name || file.name })}
          onChange={(e) =>
            handleFileSelection(selectionId, actualIndex, file, e.target.checked, e.shiftKey)
          }
          style={{ pointerEvents: 'none' }}
          className="accent-accent dark:accent-accent-dark"
        />
      </td>

      {/* File Name and Size */}
      <td
        className={`pl-3 md:pl-4 lg:pl-6 py-2 md:py-1.5 lg:py-2 overflow-hidden ${tableRowSeparator}`}
        colSpan={isMobile ? 1 : activeColumns.length}
      >
        <div
          className={`${isMobile ? 'grid grid-cols-1 gap-1' : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 md:gap-2.5 lg:gap-4'}`}
          style={{
            maxWidth: isMobile
              ? '100%'
              : tableWidth -
                getActionsColumnWidthPx() -
                getCheckboxColumnWidthPx() -
                EXTRA_COLUMN_PADDING,
          }}
        >
          <div
            className={`text-xs md:text-[11px] lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate max-w-[250px] md:max-w-md lg:max-w-xl ${isBlurred ? 'blur-[6px] select-none' : ''}`}
          >
            <Tooltip content={isBlurred ? '' : file.short_name || file.name}>
              {file.short_name || file.name}
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark 
                    text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap"
            >
              {formatSize(file.size || 0)}
            </span>
            {file.mimetype && (
              <Tooltip content={getDisplayMimetype(file.mimetype, file.name || file.short_name)}>
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 
                        text-accent dark:text-accent-dark min-w-0 max-w-[7rem] sm:max-w-[9rem] md:max-w-[12rem] truncate inline-block"
                >
                  {getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </td>

      {/* File Actions — fixed slots: [play] [copy] [download] */}
      <td
        className={`${tableActionsCell} ${actionsSurfaceClass} relative z-[2] [transform:translateZ(0)] [&_button]:md:p-1`}
      >
        <div className={tableActionsCellInner} data-file-actions>
          <span className={FILE_ACTION_SLOT_CLASS}>
            {isVideoFile(file) && handleFileStream ? (
              <button
                type="button"
                onClick={(e) => {
                  stopRowActivation(e);
                  handleFileStream(item.id, file, item.name);
                }}
                onPointerDown={stopRowActivation}
                disabled={isFileStreaming}
                className={FILE_ACTION_BUTTON_CLASS}
                title={t('play')}
                aria-label={t('play')}
              >
                {isFileStreaming ? <Spinner size="sm" /> : <Play />}
              </button>
            ) : isAudioFile(file) && handleAudioPlay ? (
              <button
                type="button"
                onClick={(e) => {
                  stopRowActivation(e);
                  handleAudioPlay(item.id, file);
                }}
                onPointerDown={stopRowActivation}
                disabled={isFileStreaming}
                className={FILE_ACTION_BUTTON_CLASS}
                title={t('play')}
                aria-label={t('play')}
              >
                {isFileStreaming ? <Spinner size="sm" /> : <Play />}
              </button>
            ) : null}
          </span>
          <span className={FILE_ACTION_SLOT_CLASS}>
            <button
              type="button"
              onClick={(e) => {
                stopRowActivation(e);
                handleFileDownload(item.id, file, true);
              }}
              onPointerDown={stopRowActivation}
              disabled={isFileCopying}
              className={FILE_ACTION_BUTTON_CLASS}
              title={t('copyLink')}
              aria-label={t('copyLink')}
            >
              {isFileCopying ? <Spinner size="sm" /> : <Copy />}
            </button>
          </span>
          <span className={FILE_ACTION_SLOT_CLASS}>
            <button
              type="button"
              onClick={(e) => {
                stopRowActivation(e);
                handleFileDownload(item.id, file);
              }}
              onPointerDown={stopRowActivation}
              disabled={isFileDownloading}
              className={FILE_ACTION_BUTTON_CLASS}
              title={t('download')}
              aria-label={t('download')}
            >
              {isFileDownloading ? <Spinner size="sm" /> : <Download />}
            </button>
          </span>
        </div>
      </td>
    </tr>
  );
}

const FileRowInnerMemo = memo(FileRowInner);

export default memo(FileRow);
