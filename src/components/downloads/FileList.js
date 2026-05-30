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
import { tableActionsCellInner } from './utils/responsiveLayout';

const FILE_ACTION_BUTTON_CLASS =
  'p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors touch-manipulation';

const FILE_ACTION_SLOT_CLASS =
  'inline-flex size-9 sm:size-7 shrink-0 items-center justify-center';

function FileListFile({
  file,
  fileIndex,
  selectionId,
  itemId,
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
      <div className={tableActionsCellInner}>
        <span className={FILE_ACTION_SLOT_CLASS}>
          {showVideoPlay ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileStream(itemId, file);
              }}
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
                e.stopPropagation();
                onAudioPlay(itemId, file);
              }}
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
              e.stopPropagation();
              onFileDownload(itemId, file.id, true);
            }}
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
              e.stopPropagation();
              onFileDownload(itemId, file.id);
            }}
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

  return (
    <div
      key={`${itemId}-${file.id}`}
      tabIndex={isDisabled ? -1 : 0}
      className={`${
        isChecked
          ? 'bg-accent/15 hover:bg-accent/20 dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : isDisabled
            ? 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
            : isFileLinkFailed?.(itemId, file.id)
              ? 'bg-link-failed dark:bg-link-failed-dark hover:bg-link-failed-hover dark:hover:bg-link-failed-hover-dark'
              : isFileDownloaded(itemId, file.id)
                ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
                : 'bg-accent/5 hover:bg-accent/10 dark:bg-surface-alt-dark/70 dark:hover:bg-surface-alt-selected-hover-dark/70'
      } rounded-md p-2 md:p-1.5 lg:p-2 ${!isDisabled && 'cursor-pointer'} w-full text-left`}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target.closest('button, input, a, select, textarea') || isDisabled) return;
        onFileSelect(itemId, fileIndex, file, !isChecked, e.shiftKey);
      }}
      onKeyDown={(e) => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !isDisabled &&
          !e.target.closest('button, input, a, select, textarea')
        ) {
          e.preventDefault();
          e.stopPropagation();
          onFileSelect(itemId, fileIndex, file, !isChecked, e.shiftKey);
        }
      }}
    >
      <div
        className={
          isMobile
            ? 'flex flex-col gap-2 min-w-0'
            : 'flex items-center justify-between gap-3 min-w-0'
        }
      >
        <div
          className={`flex min-w-0 ${isMobile ? 'items-start gap-3' : 'items-center gap-3 flex-1'}`}
        >
          <input
            type="checkbox"
            checked={isChecked}
            disabled={isDisabled}
            onChange={(e) => {
              e.stopPropagation();
              onFileSelect(itemId, fileIndex, file, e.target.checked, e.shiftKey);
            }}
            onClick={(e) => e.stopPropagation()}
            className="accent-accent dark:accent-accent-dark mt-0.5 shrink-0"
          />

          <div
            className={`min-w-0 flex-1 ${
              isMobile
                ? 'grid grid-cols-1 gap-1'
                : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3'
            }`}
          >
            <span
              className={`text-sm md:text-xs lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70 ${
                isMobile ? 'break-words' : 'truncate'
              } ${isBlurred ? 'blur-[6px] select-none' : ''}`}
              title={isBlurred ? '' : file.name}
            >
              {file.short_name || file.name}
            </span>
            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap' : ''}`}>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap w-fit">
                {formatSize(file.size || 0)}
              </span>
              {file.mimetype && !isMobile && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 text-accent dark:text-accent-dark min-w-0 max-w-[7rem] sm:max-w-[9rem] md:max-w-[12rem] truncate inline-block"
                  title={getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                >
                  {getDisplayMimetype(file.mimetype, file.name || file.short_name)}
                </span>
              )}
            </div>
          </div>

          {!isMobile && renderFileActions()}
        </div>

        {isMobile && (
          <div className="flex items-center justify-end pl-7 min-w-0">{renderFileActions()}</div>
        )}
      </div>
    </div>
  );
}

function FileList({
  files,
  itemId,
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
            key={`${itemId}-${file.id}`}
            file={file}
            fileIndex={fileIndex}
            selectionId={itemId}
            itemId={itemId}
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
