'use client';

import { memo } from 'react';
import Icons from '@/components/icons';
import { formatSize } from './utils/formatters';
import { getDisplayMimetype } from './utils/mimetypeDisplay';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';
import { isVideoFile, isAudioFile } from './utils/videoDetection';
import {
  getActionsColumnWidthPx,
  getCheckboxColumnWidthPx,
  tableActionsCell,
  tableCheckboxCell,
  tableRowSeparator,
} from './utils/responsiveLayout';

const EXTRA_COLUMN_PADDING = 10;

const FILE_ACTION_BUTTON_CLASS =
  'p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors';

/** Fixed slot so copy/download stay column-aligned when play is absent */
const FILE_ACTION_SLOT_CLASS =
  'inline-flex size-7 md:size-6 lg:size-7 shrink-0 items-center justify-center';

function FileRow({
  item,
  selectedItems,
  handleFileSelection,
  handleFileDownload,
  handleFileStream,
  handleAudioPlay,
  activeColumns,
  downloadHistoryLookup,
  isCopying,
  isDownloading,
  isStreaming,
  isMobile = false,
  isBlurred = false,
  tableWidth,
  file = null, // Single file row (preferred when list is filtered)
  fileIndex = null, // Legacy: index into item.files when file is not passed
  measureRef,
  dataIndex,
}) {
  const t = useTranslations('FileActions');
  const assetKey = (itemId, fileId) => (fileId ? `${itemId}-${fileId}` : itemId);

  const filesToRender =
    file != null
      ? [file]
      : fileIndex !== null
        ? [item.files[fileIndex]].filter(Boolean)
        : item.files;

  return (
    <>
      {filesToRender.map((file, index) => {
        // Use the provided fileIndex for the actual index, or use the map index
        const actualIndex = fileIndex !== null ? fileIndex : index;
        const isChecked = selectedItems.files.get(item.id)?.has(file.id) || false;
        const isDisabled = selectedItems.items?.has(item.id);
        const itemKey = `${item.assetType}:${String(item.id)}`;
        const isDownloaded =
          downloadHistoryLookup.itemDownloads.has(itemKey) ||
          downloadHistoryLookup.fileDownloads.has(`${itemKey}:${String(file.id)}`);

        const rowSurfaceClass = isChecked
          ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : isDownloaded
            ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
            : 'bg-surface dark:bg-surface-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark';

        return (
          <tr
            ref={fileIndex !== null ? measureRef : undefined}
            data-index={fileIndex !== null ? dataIndex : undefined}
            key={`${item.id}-${file.id}`}
            className={`${rowSurfaceClass} ${tableRowSeparator} transition-colors ${!isDisabled && 'cursor-pointer'}`}
            onMouseDown={(e) => {
              // Prevent text selection on shift+click
              if (e.shiftKey) {
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              // Ignore clicks on buttons or if disabled
              if (e.target.closest('button') || isDisabled) return;
              handleFileSelection(item.id, actualIndex, file, !isChecked, e.shiftKey);
            }}
          >
            {/* Checkbox */}
            <td className={`${tableCheckboxCell} py-2 md:py-1.5 lg:py-2`}>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) =>
                  handleFileSelection(item.id, actualIndex, file, e.target.checked, e.shiftKey)
                }
                style={{ pointerEvents: 'none' }}
                className="accent-accent dark:accent-accent-dark"
              />
            </td>

            {/* File Name and Size */}
            <td
              className="pl-3 md:pl-4 lg:pl-6 py-2 md:py-1.5 lg:py-2 overflow-hidden"
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
                    <Tooltip
                      content={getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                    >
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
              className={`${tableActionsCell} ${rowSurfaceClass} py-2 md:py-1.5 lg:py-2 md:pb-1.5 lg:pb-2 [&_button]:md:p-1`}
            >
              <div className="inline-flex items-center justify-end">
                <span className={FILE_ACTION_SLOT_CLASS}>
                  {isVideoFile(file) && handleFileStream ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFileStream(item.id, file);
                      }}
                      disabled={isStreaming?.[assetKey(item.id, file.id)]}
                      className={FILE_ACTION_BUTTON_CLASS}
                      title={t('play')}
                    >
                      {isStreaming?.[assetKey(item.id, file.id)] ? (
                        <Spinner size="sm" />
                      ) : (
                        <Icons.Play />
                      )}
                    </button>
                  ) : isAudioFile(file) && handleAudioPlay ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAudioPlay(item.id, file);
                      }}
                      disabled={isStreaming?.[assetKey(item.id, file.id)]}
                      className={FILE_ACTION_BUTTON_CLASS}
                      title={t('play')}
                    >
                      {isStreaming?.[assetKey(item.id, file.id)] ? (
                        <Spinner size="sm" />
                      ) : (
                        <Icons.Play />
                      )}
                    </button>
                  ) : null}
                </span>
                <span className={FILE_ACTION_SLOT_CLASS}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileDownload(item.id, file, true);
                    }}
                    disabled={isCopying[assetKey(item.id, file.id)]}
                    className={FILE_ACTION_BUTTON_CLASS}
                    title={t('copyLink')}
                  >
                    {isCopying[assetKey(item.id, file.id)] ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icons.Copy />
                    )}
                  </button>
                </span>
                <span className={FILE_ACTION_SLOT_CLASS}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFileDownload(item.id, file);
                    }}
                    disabled={isDownloading[assetKey(item.id, file.id)]}
                    className={FILE_ACTION_BUTTON_CLASS}
                    title={t('download')}
                  >
                    {isDownloading[assetKey(item.id, file.id)] ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icons.Download />
                    )}
                  </button>
                </span>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default memo(FileRow);
