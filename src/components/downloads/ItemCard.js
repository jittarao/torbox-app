'use client';

import { memo } from 'react';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';
import Tooltip from '@/components/shared/Tooltip';
import {
  All,
  ArrowLeftRight,
  Clock,
  ClockArrowDown,
  CloudDownload,
  CloudUpload,
  DownArrow,
  Download,
  Files,
  Hash,
  Layers,
  Link,
  Lock,
  Percent,
  Private,
  Tag,
  Unlock,
  UpArrow,
} from '@/components/icons';
import useIsMobile from '@/hooks/useIsMobile';
import FileList from './FileList';
import { useTranslations } from 'next-intl';
import TagDisplay from './Tags/TagDisplay';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import {
  useIsDownloadSelected,
  useItemHasSelectedFiles,
} from '@/components/shared/hooks/useSelection';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import {
  cardContainerPad,
  tableActionsCellInner,
  tableRowFocusClasses,
} from './utils/responsiveLayout';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';

function normalizeBooleanValue(value) {
  return value === true || value === 1 || value === 'true';
}

const COLUMNS_WITH_INLINE_ICON = new Set(['airlocked', 'private', 'tags']);

function ItemCard({
  item,
  index,
  downloadHistoryLookup,
  isBlurred,
  activeColumns,
  handleItemSelection,
  handleFileSelection,
  handleFileDownload,
  handleFileStream,
  handleAudioPlay,
  onDelete,
  toggleFiles,
  fileSearch = '',
  setToast,
  activeType,
  viewMode,
  apiKey,
}) {
  const columnT = useTranslations('Columns');
  const commonT = useTranslations('Common');
  const isMobile = useIsMobile();
  const isExpanded = useDownloadsUiStore((s) => Boolean(s.expandedById[item.id]));
  const visibleFiles = getFilesVisibleForDownloadSearch(item, fileSearch);
  const isAirlocked = normalizeBooleanValue(item.airlocked);

  const filteredColumns = activeColumns.filter(
    (column) =>
      ![
        'name',
        'progress',
        'download_progress',
        'download_state',
        'download_speed',
        'upload_speed',
      ].includes(column)
  );

  const getTooltipContent = (column) => {
    switch (column) {
      case 'id':
        return columnT('id');
      case 'hash':
        return columnT('hash');
      case 'seeds':
        return columnT('seeds');
      case 'peers':
        return columnT('peers');
      case 'ratio':
        return columnT('ratio');
      case 'size':
        return columnT('size');
      case 'file_count':
        return columnT('file_count');
      case 'created_at':
        return columnT('created_at');
      case 'cached_at':
        return columnT('cached_at');
      case 'updated_at':
        return columnT('updated_at');
      case 'expires_at':
        return columnT('expires_at');
      case 'eta':
        return columnT('eta');
      case 'total_downloaded':
        return columnT('total_downloaded');
      case 'total_uploaded':
        return columnT('total_uploaded');
      case 'original_url':
        return columnT('original_url');
      case 'download_progress':
        return columnT('download_progress');
      case 'asset_type':
        return columnT('asset_type');
      case 'private':
        return columnT('private');
      case 'airlocked':
        return columnT('airlocked');
      case 'tags':
        return columnT('tags');
    }
  };

  const getColumnIcon = (column) => {
    switch (column) {
      case 'id':
        return <ArrowLeftRight />;
      case 'hash':
        return <Hash />;
      case 'seeds':
        return <UpArrow />;
      case 'peers':
        return <DownArrow />;
      case 'ratio':
        return <Percent />;
      case 'size':
        return <Layers />;
      case 'file_count':
        return <Files />;
      case 'created_at':
      case 'cached_at':
      case 'updated_at':
      case 'expires_at':
        return <Clock />;
      case 'eta':
        return <ClockArrowDown />;
      case 'total_downloaded':
        return <CloudDownload />;
      case 'total_uploaded':
        return <CloudUpload />;
      case 'original_url':
        return <Link />;
      case 'download_progress':
        return <Download />;
      case 'asset_type':
        return <All />;
      case 'private':
        return <Private />;
      case 'airlocked':
        return <Lock />;
      case 'tags':
        return <Tag />;
    }
  };

  const renderDownloadProgress = (item) => {
    // Only show progress for active downloads
    if (!item.active || item.download_finished) {
      return null;
    }

    const downloadSpeed = item.download_speed || 0;
    const totalSize = item.size || 0;

    // For usenet and webdl, use the progress field if available
    // For torrents, calculate from total_downloaded if available
    let progress = 0;
    let downloadedSize = 0;

    if (item.assetType === 'usenet' || item.assetType === 'webdl') {
      // Use progress field (0-1) for usenet and webdl
      progress = (item.progress || 0) * 100;
      downloadedSize = totalSize * (item.progress || 0);
    } else {
      // For torrents, use total_downloaded if available, otherwise fall back to progress
      downloadedSize = item.total_downloaded || 0;
      if (totalSize > 0 && downloadedSize > 0) {
        progress = (downloadedSize / totalSize) * 100;
      } else if (item.progress !== undefined) {
        progress = (item.progress || 0) * 100;
        downloadedSize = totalSize * (item.progress || 0);
      }
    }

    // Calculate ETA based on remaining size and speed
    const remainingSize = totalSize - downloadedSize;
    const etaSeconds = downloadSpeed > 0 ? remainingSize / downloadSpeed : 0;

    return (
      <div className="flex flex-col gap-1 min-w-0">
        {/* Progress bar */}
        <div className="w-full bg-progress-track dark:bg-progress-track-dark rounded-full h-2">
          <div
            className="bg-accent dark:bg-accent-dark h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>

        {/* Progress text */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-primary-text/70 dark:text-primary-text-dark/70">
            {progress.toFixed(1)}%
          </span>
          <span className="text-primary-text/60 dark:text-primary-text-dark/60">
            {formatSize(downloadedSize)} / {formatSize(totalSize)}
          </span>
        </div>

        {/* Speed and ETA */}
        {downloadSpeed > 0 && (
          <div className="flex items-center justify-between text-xs text-primary-text/60 dark:text-primary-text-dark/60">
            <span>↓ {formatSpeed(downloadSpeed)}</span>
            {etaSeconds > 0 && <span>ETA: {formatEta(etaSeconds, commonT)}</span>}
          </div>
        )}
      </div>
    );
  };

  const getColumnValue = (column, item) => {
    switch (column) {
      case 'id':
        return item.id;
      case 'hash':
        return item.hash;
      case 'seeds':
        return item.seeds;
      case 'peers':
        return item.peers;
      case 'ratio':
        return item.ratio?.toFixed(1);
      case 'size':
        return formatSize(item.size || 0);
      case 'file_count':
        return item.files?.length || 0;
      case 'created_at':
        return timeAgo(item.created_at, commonT);
      case 'cached_at':
        return timeAgo(item.cached_at, commonT);
      case 'updated_at':
        return timeAgo(item.updated_at, commonT);
      case 'expires_at':
        return timeAgo(item.expires_at, commonT);
      case 'eta':
        return timeAgo(item.eta, commonT);
      case 'total_downloaded':
        return formatSize(item.total_downloaded);
      case 'total_uploaded':
        return formatSize(item.total_uploaded);
      case 'download_progress':
        return renderDownloadProgress(item);
      case 'original_url':
        return item.original_url;
      case 'asset_type':
        return (
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
        );
      case 'private':
        return item.private ? (
          <div className="flex items-center gap-2">
            <Private className="size-4 text-orange-500 dark:text-orange-400" />
            <span>Private</span>
          </div>
        ) : (
          <span>Public</span>
        );
      case 'airlocked':
        return normalizeBooleanValue(item.airlocked) ? (
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-accent dark:text-accent-dark" />
            <span>{commonT('airlocked')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Unlock className="size-4 text-primary-text/40 dark:text-primary-text-dark/40" />
            <span>{commonT('notAirlocked')}</span>
          </div>
        );
      case 'tags':
        return item.tags && item.tags.length > 0 ? <TagDisplay tags={item.tags} /> : null;
    }
  };

  const selectionId = getDownloadSelectionId(item);
  const itemKey = `${item.assetType}:${String(item.id)}`;
  const isDownloaded = downloadHistoryLookup?.itemDownloads?.has(itemKey) ?? false;
  const isLinkFailed = downloadHistoryLookup?.itemLinkFailed?.has(itemKey) ?? false;
  const isSelected = useIsDownloadSelected(selectionId);
  const hasSelectedFiles = useItemHasSelectedFiles(selectionId);

  const isFileDownloaded = (fileSelectionId, fileId) =>
    downloadHistoryLookup?.itemDownloads?.has(fileSelectionId) ||
    downloadHistoryLookup?.fileDownloads?.has(`${fileSelectionId}:${String(fileId)}`);

  const isFileLinkFailed = (fileSelectionId, fileId) =>
    downloadHistoryLookup?.itemLinkFailed?.has(fileSelectionId) ||
    downloadHistoryLookup?.fileLinkFailed?.has(`${fileSelectionId}:${String(fileId)}`);

  const onFileDownload = (itemId, fileOrId, copyLink) => {
    const file =
      typeof fileOrId === 'object' && fileOrId !== null
        ? fileOrId
        : visibleFiles.find((f) => String(f.id) === String(fileOrId));
    if (file) handleFileDownload(itemId, file, copyLink);
  };

  const handleCardSelect = (shiftKey) => {
    if (hasSelectedFiles) return;
    handleItemSelection(selectionId, !isSelected, index, shiftKey);
  };

  const renderSpeedIndicators = () =>
    item.active ? (
      <div className="flex items-center gap-2 md:gap-3 lg:gap-4 text-xs md:text-sm lg:text-[14.5px] text-primary-text/70 dark:text-primary-text-dark/70">
        <div className="flex items-center gap-1">
          <span className="text-label-success-text-dark dark:text-label-success-text-dark">↓</span>
          <span>{formatSpeed(item.download_speed)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-label-danger-text-dark dark:text-label-danger-text-dark">↑</span>
          <span>{formatSpeed(item.upload_speed)}</span>
        </div>
      </div>
    ) : null;

  return (
    <div
      onMouseDown={(e) => {
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (e.target.closest('button, input, a, select, textarea') || hasSelectedFiles) return;
        handleCardSelect(e.shiftKey);
        e.currentTarget.blur();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Shift') {
          e.currentTarget.blur();
          return;
        }
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !e.target.closest('button, input, a, select, textarea') &&
          !hasSelectedFiles
        ) {
          e.preventDefault();
          handleCardSelect(e.shiftKey);
        }
      }}
      tabIndex={0}
      className={`${
        isSelected
          ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : isLinkFailed
            ? 'bg-link-failed dark:bg-link-failed-dark hover:bg-link-failed-hover dark:hover:bg-link-failed-hover-dark'
            : isDownloaded
              ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
              : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
      } ${cardContainerPad} ${tableRowFocusClasses} relative ${
        isExpanded ? 'overflow-visible' : 'overflow-hidden'
      } cursor-pointer w-full text-left`}
    >
      <div className={isMobile ? 'flex flex-col gap-2' : 'flex justify-between gap-2 md:gap-3'}>
        <div className="flex flex-col justify-center gap-1.5 md:gap-2 min-w-0 flex-1">
          <div
            className={isMobile ? 'flex items-start gap-2' : 'flex items-center gap-2 md:gap-2.5'}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) =>
                handleItemSelection(selectionId, e.target.checked, index, e.shiftKey)
              }
              onClick={(e) => e.stopPropagation()}
              disabled={hasSelectedFiles}
              className="accent-accent dark:accent-accent-dark flex-shrink-0 mt-0.5 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
            />
            <h3
              className={`text-sm md:text-base lg:text-[18px] font-medium text-primary-text dark:text-primary-text-dark flex-1 min-w-0 ${
                isBlurred ? 'blur-[6px] select-none' : ''
              }`}
            >
              <div
                className={
                  isMobile
                    ? 'grid w-full min-w-0 grid-cols-[auto_1fr] items-start gap-x-2'
                    : 'flex items-center gap-2'
                }
              >
                <div className={`flex shrink-0 gap-2 ${isMobile ? 'items-start' : 'items-center'}`}>
                  <Tooltip content={item.cached ? 'Cached' : 'Not cached'}>
                    <span
                      className={`inline-block size-2 rounded-full shrink-0 mt-1.5 ${
                        item.cached
                          ? 'bg-label-success-text-dark dark:bg-label-success-text-dark'
                          : 'bg-label-danger-text-dark dark:bg-label-danger-text-dark'
                      }`}
                    ></span>
                  </Tooltip>
                  {item.private && (
                    <Tooltip content="Private Tracker">
                      <Private className="size-4 shrink-0 text-orange-500 dark:text-orange-400 mt-0.5" />
                    </Tooltip>
                  )}
                  {isAirlocked && (
                    <Tooltip content={commonT('airlocked')}>
                      <Lock className="size-4 shrink-0 text-accent dark:text-accent-dark mt-0.5" />
                    </Tooltip>
                  )}
                </div>
                {item.name && (
                  <div className="min-w-0">
                    <Tooltip content={!isBlurred ? item.name : ''}>
                      <span
                        className={
                          isMobile
                            ? 'inline-block max-w-full min-w-0 break-words'
                            : 'inline-block max-w-full min-w-0 truncate'
                        }
                      >
                        {item.name || 'Unnamed Item'}
                      </span>
                    </Tooltip>
                  </div>
                )}
              </div>
            </h3>
          </div>

          <div
            className={`flex items-center flex-wrap ${
              isMobile ? 'gap-2 pl-6' : 'gap-2 md:gap-x-2.5 md:gap-y-1 lg:gap-4'
            } text-xs md:text-[11px] lg:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
          >
            <DownloadStateBadge item={item} size={isMobile ? 'xs' : 'sm'} />
            {isMobile && renderSpeedIndicators()}
            {!isMobile ? (
              <>
                {filteredColumns.map((column) => {
                  const value = getColumnValue(column, item);
                  if (value == null || value === '') return null;

                  return (
                    <div
                      className="flex items-center gap-1 font-medium md:font-normal shrink-0"
                      key={column}
                    >
                      <div className="flex items-center gap-0.5 md:gap-1 [&_svg]:md:h-3.5 [&_svg]:md:w-3.5">
                        {!COLUMNS_WITH_INLINE_ICON.has(column) && (
                          <Tooltip content={getTooltipContent(column)}>
                            {getColumnIcon(column)}{' '}
                          </Tooltip>
                        )}
                        {['created_at', 'cached_at', 'updated_at', 'expires_at'].includes(
                          column
                        ) ? (
                          <Tooltip content={formatDate(item[column])}>
                            <span>{value}</span>
                          </Tooltip>
                        ) : (
                          <span>{value}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <span>{formatSize(item.size || 0)}</span>{' '}
                <span>{timeAgo(item.created_at, commonT)}</span>
              </>
            )}
          </div>

          {isMobile && (
            <div className="mt-2 border-t border-border/40 pt-2 pl-6 dark:border-border-dark/40">
              <ItemActions
                item={item}
                apiKey={apiKey}
                onDelete={onDelete}
                toggleFiles={toggleFiles}
                isExpanded={isExpanded}
                setToast={setToast}
                activeType={activeType}
                mobileBar
              />
            </div>
          )}
        </div>

        {!isMobile && (
          <div className="flex flex-col items-end justify-between gap-1.5 md:gap-2 flex-shrink-0">
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

            {renderSpeedIndicators()}
          </div>
        )}
      </div>

      {isExpanded && visibleFiles.length > 0 && (
        <FileList
          files={visibleFiles}
          itemId={selectionId}
          isBlurred={isBlurred}
          onFileSelect={handleFileSelection}
          onFileDownload={onFileDownload}
          onFileStream={handleFileStream}
          onAudioPlay={handleAudioPlay}
          isMobile={isMobile}
          isFileDownloaded={isFileDownloaded}
          isFileLinkFailed={isFileLinkFailed}
        />
      )}

      {item.progress < 1 && item.active && !item.download_present && (
        <div className="absolute bottom-0 left-0 w-full">
          {item.progress !== undefined && (
            <div
              className="bg-accent/40 dark:bg-accent-dark/40 h-1 rounded-full"
              style={{ width: `${(item.progress || 0) * 100}%` }}
            ></div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ItemCard);
