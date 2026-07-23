'use client';

import { memo } from 'react';
import { formatSize } from './utils/formatters';
import { getDisplayMimetype } from './utils/mimetypeDisplay';
import { Copy, Download, Play } from '@/components/icons';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';
import { isVideoFile, isAudioFile } from './utils/videoDetection';
import {
  useIsFileSelected,
  useIsItemBlockingFileSelect,
} from '@/components/shared/hooks/useSelection';
import {
  selectIsFileCopying,
  selectIsFileDownloading,
  selectIsFileStreaming,
  useFileInteractionStore,
} from '@/store/fileInteractionStore';
import { tableRowFocusClasses } from './utils/responsiveLayout';
const FILE_ACTION_BUTTON_CLASS =
  'p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors touch-manipulation';

const FILE_ACTION_SLOT_CLASS = 'inline-flex size-9 sm:size-7 shrink-0 items-center justify-center';

/** Card file rows — no w-full (tableActionsCellInner steals flex space and hides filenames). */
const FILE_LIST_ACTIONS_CLASS =
  'flex shrink-0 flex-nowrap items-center justify-end gap-1.5 md:gap-1';

function stopRowActivation(e) {
  e.stopPropagation();
}

function FileListFile({
  file,
  fileIndex,
  selectionId,
  itemId,
  itemName,
  isBlurred,
  onFileSelect,
  onFileDownload,
  onFileStream,
  onAudioPlay,
  isMobile,
  isFileDownloaded,
  isFileLinkFailed,
}) {
  const t = useTranslations('FileActions');
  const commonT = useTranslations('Common');
  const isChecked = useIsFileSelected(selectionId, file.id);
  const isDisabled = useIsItemBlockingFileSelect(selectionId);
  const storeFileKey = `${String(itemId)}-${String(file.id)}`;
  const isFileDownloading = useFileInteractionStore(selectIsFileDownloading(storeFileKey));
  const isFileCopying = useFileInteractionStore(selectIsFileCopying(storeFileKey));
  const isFileStreaming = useFileInteractionStore(selectIsFileStreaming(storeFileKey));

  const renderFileActions = () => {
    const showVideoPlay = isVideoFile(file) && onFileStream;
    const showAudioPlay = isAudioFile(file) && onAudioPlay;

    return (
      <div
        className={FILE_LIST_ACTIONS_CLASS}
        data-file-actions
        onClick={stopRowActivation}
        onPointerDown={stopRowActivation}
      >
        <span className={FILE_ACTION_SLOT_CLASS}>
          {showVideoPlay ? (
            <button
              type="button"
              onClick={(e) => {
                stopRowActivation(e);
                onFileStream(itemId, file, itemName);
              }}
              onPointerDown={stopRowActivation}
              disabled={isFileStreaming}
              className={FILE_ACTION_BUTTON_CLASS}
              title={t('play')}
              aria-label={t('play')}
            >
              {isFileStreaming ? <Spinner size="sm" /> : <Play />}
            </button>
          ) : showAudioPlay ? (
            <button
              type="button"
              onClick={(e) => {
                stopRowActivation(e);
                onAudioPlay(itemId, file);
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
              onFileDownload(itemId, file.id, true);
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
              onFileDownload(itemId, file.id);
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
    );
  };

  const handleSelectRow = (e) => {
    if (isDisabled) return;
    onFileSelect(selectionId, fileIndex, file, !isChecked, e.shiftKey);
  };

  const rowSurfaceClass = `${
    isChecked
      ? 'bg-accent/15 hover:bg-accent/20 dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
      : isDisabled
        ? 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
        : isFileLinkFailed?.(selectionId, file.id)
          ? 'bg-link-failed dark:bg-link-failed-dark hover:bg-link-failed-hover dark:hover:bg-link-failed-hover-dark'
          : isFileDownloaded(selectionId, file.id)
            ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
            : 'bg-accent/5 hover:bg-accent/10 dark:bg-surface-alt-dark/70 dark:hover:bg-surface-alt-selected-hover-dark/70'
  } rounded-md p-2 md:p-1.5 lg:p-2 w-full text-left${isMobile ? ' flex flex-col gap-2' : ''}`;

  return (
    <div key={`${selectionId}-${file.id}`} className={rowSurfaceClass}>
      {isMobile ? (
        <>
          <div
            className={`flex min-w-0 items-start gap-3 ${!isDisabled ? 'cursor-pointer' : ''}`}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target.closest('button, input, a, select, textarea') || isDisabled) return;
              handleSelectRow(e);
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled}
              aria-label={commonT('selectRow', { name: file.short_name || file.name })}
              onChange={(e) => {
                e.stopPropagation();
                onFileSelect(selectionId, fileIndex, file, e.target.checked, e.shiftKey);
              }}
              onClick={(e) => e.stopPropagation()}
              className="accent-accent dark:accent-accent-dark mt-0.5 shrink-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            />
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-1">
              <div
                className={`text-sm text-primary-text/70 dark:text-primary-text-dark/70 min-w-0 break-words ${isBlurred ? 'blur-[6px] select-none' : ''}`}
                title={isBlurred ? '' : file.short_name || file.name}
              >
                {file.short_name || file.name}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap w-fit">
                  {formatSize(file.size || 0)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end pl-7 min-w-0 touch-manipulation">
            {renderFileActions()}
          </div>
        </>
      ) : (
        <div
          className={`flex items-center justify-between gap-3 min-w-0 ${tableRowFocusClasses} ${!isDisabled && 'cursor-pointer'}`}
          tabIndex={isDisabled ? -1 : 0}
          onMouseDown={(e) => {
            if (e.shiftKey) e.preventDefault();
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (
              e.target.closest('button, input, a, select, textarea, [data-file-actions]') ||
              isDisabled
            ) {
              return;
            }
            handleSelectRow(e);
            e.currentTarget.blur();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Shift') {
              e.currentTarget.blur();
              return;
            }
            if (
              (e.key === 'Enter' || e.key === ' ') &&
              !isDisabled &&
              !e.target.closest('button, input, a, select, textarea, [data-file-actions]')
            ) {
              e.preventDefault();
              e.stopPropagation();
              handleSelectRow(e);
            }
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <input
              type="checkbox"
              checked={isChecked}
              disabled={isDisabled}
              aria-label={commonT('selectRow', { name: file.short_name || file.name })}
              onChange={(e) => {
                e.stopPropagation();
                onFileSelect(selectionId, fileIndex, file, e.target.checked, e.shiftKey);
              }}
              onClick={(e) => e.stopPropagation()}
              className="accent-accent dark:accent-accent-dark mt-0.5 shrink-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            />
            <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
              <div
                className={`text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70 min-w-0 w-0 flex-1 truncate ${isBlurred ? 'blur-[6px] select-none' : ''}`}
                title={isBlurred ? '' : file.short_name || file.name}
              >
                {file.short_name || file.name}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap w-fit">
                  {formatSize(file.size || 0)}
                </span>
                {file.mimetype && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 text-accent dark:text-accent-dark min-w-0 max-w-[7rem] sm:max-w-[9rem] md:max-w-[12rem] truncate inline-block"
                    title={getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                  >
                    {getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                  </span>
                )}
              </div>
            </div>
            {renderFileActions()}
          </div>
        </div>
      )}
    </div>
  );
}

function FileList({
  files,
  selectionId,
  itemId,
  itemName,
  isBlurred,
  onFileSelect,
  onFileDownload,
  onFileStream,
  onAudioPlay,
  isMobile,
  isFileDownloaded,
  isFileLinkFailed,
}) {
  return (
    <div className="mt-3 md:mt-2.5 lg:mt-4 border-t border-border/50 dark:border-border-dark/50 pt-3 md:pt-2.5 lg:pt-4">
      <div className="space-y-1.5 md:space-y-1 lg:space-y-2">
        {files.map((file, fileIndex) => (
          <FileListFile
            key={`${selectionId}-${file.id}`}
            file={file}
            fileIndex={fileIndex}
            selectionId={selectionId}
            itemId={itemId}
            itemName={itemName}
            isBlurred={isBlurred}
            onFileSelect={onFileSelect}
            onFileDownload={onFileDownload}
            onFileStream={onFileStream}
            onAudioPlay={onAudioPlay}
            isMobile={isMobile}
            isFileDownloaded={isFileDownloaded}
            isFileLinkFailed={isFileLinkFailed}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(FileList);
