import { memo } from 'react';
import { formatSize, formatSpeed, formatEta, timeAgo, formatDate } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';
import Tooltip from '@/components/shared/Tooltip';
import Icons from '@/components/icons';
import useIsMobile from '@/hooks/useIsMobile';
import FileList from './FileList';
import { useTranslations } from 'next-intl';
import TagDisplay from './Tags/TagDisplay';

function ItemCard({
  item,
  index,
  selectedItems,
  downloadHistory,
  isItemDownloaded,
  isFileDownloaded,
  isBlurred,
  isDisabled,
  activeColumns,
  onItemSelect,
  onFileSelect,
  onFileDownload,
  onFileStream,
  onAudioPlay,
  onDelete,
  toggleFiles,
  expandedItems,
  setItems,
  setSelectedItems,
  setToast,
  activeType,
  viewMode,
  isCopying,
  isDownloading,
  isStreaming,
  apiKey,
}) {
  const columnT = useTranslations('Columns');
  const commonT = useTranslations('Common');
  const isMobile = useIsMobile();

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
    }
  };

  const getColumnIcon = (column) => {
    switch (column) {
      case 'id':
        return <Icons.ArrowLeftRight />;
      case 'hash':
        return <Icons.Hash />;
      case 'seeds':
        return <Icons.UpArrow />;
      case 'peers':
        return <Icons.DownArrow />;
      case 'ratio':
        return <Icons.Percent />;
      case 'size':
        return <Icons.Layers />;
      case 'file_count':
        return <Icons.Files />;
      case 'created_at':
      case 'cached_at':
      case 'updated_at':
      case 'expires_at':
        return <Icons.Clock />;
      case 'eta':
        return <Icons.ClockArrowDown />;
      case 'total_downloaded':
        return <Icons.CloudDownload />;
      case 'total_uploaded':
        return <Icons.CloudUpload />;
      case 'original_url':
        return <Icons.Link />;
      case 'download_progress':
        return <Icons.Download />;
      case 'asset_type':
        return <Icons.All />;
      case 'private':
        return <Icons.Private />;
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
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
              className={`inline-block w-2 h-2 rounded-full ${
                item.assetType === 'torrents'
                  ? 'bg-blue-500'
                  : item.assetType === 'usenet'
                    ? 'bg-green-500'
                    : item.assetType === 'webdl'
                      ? 'bg-purple-500'
                      : 'bg-gray-500'
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
            <Icons.Private className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            <span>Private</span>
          </div>
        ) : (
          <span>Public</span>
        );
    }
  };

  return (
    <div
      onMouseDown={(e) => {
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (isDisabled(item.id)) return;
        const isChecked = selectedItems.items?.has(item.id);
        onItemSelect(item.id, !isChecked, index, e.shiftKey);
      }}
      className={`${
        selectedItems.items?.has(item.id)
          ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : isItemDownloaded(item.id)
            ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
            : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
      } px-2 py-4 md:p-4 relative rounded-lg border border-border dark:border-border-dark overflow-hidden cursor-pointer`}
    >
      <div className="flex justify-between gap-2">
        <div className="flex flex-col justify-center gap-2 min-w-0">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedItems.items?.has(item.id)}
              onChange={(e) => onItemSelect(item.id, e.target.checked, index)}
              onClick={(e) => e.stopPropagation()}
              disabled={isDisabled(item.id)}
              className="accent-accent dark:accent-accent-dark flex-shrink-0"
            />
            <h3
              className={`text-sm sm:text-md md:text-[18px] font-medium break-all text-primary-text dark:text-primary-text-dark flex-1 ${
                isBlurred ? 'blur-[6px] select-none' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Tooltip content={item.cached ? 'Cached' : 'Not cached'}>
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      item.cached
                        ? 'bg-label-success-text-dark dark:bg-label-success-text-dark'
                        : 'bg-label-danger-text-dark dark:bg-label-danger-text-dark'
                    }`}
                  ></span>
                </Tooltip>
                {item.private && (
                  <Tooltip content="Private Tracker">
                    <Icons.Private className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                  </Tooltip>
                )}
                {item.name && (
                  <Tooltip content={!isBlurred ? item.name : ''}>
                    <span>{item.name || 'Unnamed Item'}</span>
                  </Tooltip>
                )}
              </div>
            </h3>
          </div>

          <div
            className={`flex items-center ${
              isMobile ? 'gap-2' : 'gap-4'
            } text-xs md:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
          >
            <DownloadStateBadge item={item} size={isMobile ? 'xs' : 'sm'} />
            {!isMobile ? (
              <>
                {filteredColumns.map((column) => (
                  <div className="flex items-center gap-1 font-semibold" key={column}>
                    <div className="flex items-center gap-1">
                      <Tooltip content={getTooltipContent(column)}>
                        {getColumnIcon(column)}{' '}
                      </Tooltip>
                      {['created_at', 'cached_at', 'updated_at', 'expires_at'].includes(column) ? (
                        <Tooltip content={formatDate(item[column])}>
                          <span>{getColumnValue(column, item)}</span>
                        </Tooltip>
                      ) : (
                        <span>{getColumnValue(column, item)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <span>{formatSize(item.size || 0)}</span>{' '}
                {item.ratio !== undefined && item.ratio !== null && (
                  <>
                    <span>{item.ratio.toFixed(2)}</span>{' '}
                  </>
                )}
                <span>{timeAgo(item.created_at, commonT)}</span>
              </>
            )}

            {/* Tags display */}
            {item.tags && item.tags.length > 0 && <TagDisplay tags={item.tags} />}
          </div>
        </div>

        <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
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
            isMobile={isMobile}
            viewMode={viewMode}
            downloadHistory={downloadHistory}
          />

          {item.active && (
            <div className="flex items-center gap-4 text-sm md:text-[14.5px] text-primary-text/70 dark:text-primary-text-dark/70">
              <div className="flex items-center gap-1">
                <span className="text-label-success-text-dark dark:text-label-success-text-dark">
                  ↓
                </span>
                <span>{formatSpeed(item.download_speed)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-label-danger-text-dark dark:text-label-danger-text-dark">
                  ↑
                </span>
                <span>{formatSpeed(item.upload_speed)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {expandedItems.has(item.id) && item.files && item.files.length > 0 && (
        <FileList
          files={item.files}
          itemId={item.id}
          selectedItems={selectedItems}
          isFileDownloaded={isFileDownloaded}
          isDisabled={isDisabled(item.id)}
          isBlurred={isBlurred}
          onFileSelect={onFileSelect}
          onFileDownload={onFileDownload}
          onFileStream={onFileStream}
          onAudioPlay={onAudioPlay}
          isCopying={isCopying}
          isDownloading={isDownloading}
          isStreaming={isStreaming}
          isMobile={isMobile}
        />
      )}

      {item.progress < 1 && item.active && !item.download_present && (
        <div className="absolute bottom-0 left-0 w-full">
          {item.progress !== undefined && (
            <div
              className="bg-blue-600/40 dark:bg-blue-500/40 h-1 rounded-full"
              style={{ width: `${(item.progress || 0) * 100}%` }}
            ></div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ItemCard);
