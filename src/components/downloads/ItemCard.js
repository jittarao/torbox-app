'use client';

import { memo, useMemo } from 'react';
import { formatSize, formatSpeed, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';
import Tooltip from '@/components/shared/Tooltip';
import ItemCardTitleRow from './ItemCardTitleRow';
import useIsMobile from '@/hooks/useIsMobile';
import FileList from './FileList';
import { useTranslations } from 'next-intl';
import { getDownloadSelectionId } from '@/utils/downloadSelectionId';
import {
  useIsDownloadSelected,
  useItemHasSelectedFiles,
} from '@/components/shared/hooks/useSelection';
import { useDownloadsUiStore } from '@/store/downloadsUiStore';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { getFilesVisibleForDownloadSearch } from './utils/downloadSearch';
import {
  cardContainerPad,
  tableActionsCellInner,
  tableRowFocusClasses,
} from './utils/responsiveLayout';
import {
  COLUMNS_WITH_INLINE_ICON,
  getItemCardColumnIcon,
  getItemCardColumnValue,
  getItemCardTooltipContent,
  normalizeBooleanValue,
} from './itemCardColumns';

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
  apiKey,
}) {
  const columnT = useTranslations('Columns');
  const commonT = useTranslations('Common');
  const isMobile = useIsMobile();
  const isExpanded = useDownloadsUiStore((s) => Boolean(s.expandedById[item.id]));
  const selectionKey = getDownloadSelectionId(item);
  const cachedFiles = useTorboxDownloadsStore((s) => s.filesByEntityKey[selectionKey]);
  const visibleFiles = useMemo(
    () =>
      getFilesVisibleForDownloadSearch(
        item,
        fileSearch,
        cachedFiles ? { [selectionKey]: cachedFiles } : null
      ),
    [item, fileSearch, selectionKey, cachedFiles]
  );
  const isAirlocked = normalizeBooleanValue(item.airlocked);
  const isProtected = item.is_protected === true;

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
        if (
          e.target.closest('button, input, a, select, textarea, [data-file-actions]') ||
          hasSelectedFiles
        ) {
          return;
        }
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
          !e.target.closest('button, input, a, select, textarea, [data-file-actions]') &&
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
          <ItemCardTitleRow
            item={item}
            isBlurred={isBlurred}
            isMobile={isMobile}
            isSelected={isSelected}
            hasSelectedFiles={hasSelectedFiles}
            isAirlocked={isAirlocked}
            isProtected={isProtected}
            commonT={commonT}
            selectionId={selectionId}
            index={index}
            onItemSelection={handleItemSelection}
          />

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
                  const value = getItemCardColumnValue(column, item, commonT);
                  if (value == null || value === '') return null;

                  return (
                    <div
                      className="flex items-center gap-1 font-medium md:font-normal shrink-0"
                      key={column}
                    >
                      <div className="flex items-center gap-0.5 md:gap-1 [&_svg]:md:h-3.5 [&_svg]:md:w-3.5">
                        {!COLUMNS_WITH_INLINE_ICON.has(column) && (
                          <Tooltip content={getItemCardTooltipContent(column, columnT)}>
                            {getItemCardColumnIcon(column)}{' '}
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
          selectionId={selectionId}
          itemId={item.id}
          itemName={item.name}
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
