import { formatSize, formatSpeed, timeAgo } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';
import { useRef, useState } from 'react';
import useIsMobile from '@/hooks/useIsMobile';
import { Icons } from '@/components/constants';
import Tooltip from '@/components/shared/Tooltip';
import { useDownloads } from '../shared/hooks/useDownloads';
import Spinner from '../shared/Spinner';

export default function CardList({
  items,
  selectedItems,
  setSelectedItems,
  setItems,
  apiKey,
  activeColumns,
  onFileSelect,
  onDelete,
  expandedItems,
  toggleFiles,
  setToast,
  activeType,
  isBlurred,
  isFullscreen,
  viewMode = 'card',
}) {
  const isMobile = useIsMobile();
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const { downloadSingle } = useDownloads(apiKey, activeType);

  const handleItemSelection = (
    itemId,
    checked,
    rowIndex,
    isShiftKey = false,
  ) => {
    if (
      isShiftKey &&
      typeof rowIndex === 'number' &&
      lastClickedItemIndexRef.current !== null
    ) {
      const start = Math.min(lastClickedItemIndexRef.current, rowIndex);
      const end = Math.max(lastClickedItemIndexRef.current, rowIndex);

      setSelectedItems((prev) => {
        const newItems = new Set(prev.items);
        for (let i = start; i <= end; i++) {
          const t = items[i];
          if (checked && !isDisabled(t.id)) {
            newItems.add(t.id);
          } else {
            newItems.delete(t.id);
          }
        }
        return {
          items: newItems,
          files: prev.files,
        };
      });
    } else {
      setSelectedItems((prev) => {
        const newItems = new Set(prev.items);
        if (checked && !isDisabled(itemId)) {
          newItems.add(itemId);
        } else {
          newItems.delete(itemId);
        }
        return {
          items: newItems,
          files: prev.files,
        };
      });
    }
    lastClickedItemIndexRef.current = rowIndex;
  };

  const handleFileSelection = (
    itemId,
    fileIndex,
    file,
    checked,
    isShiftKey = false,
  ) => {
    if (isShiftKey && lastClickedFileIndexRef.current !== null) {
      const start = Math.min(lastClickedFileIndexRef.current, fileIndex);
      const end = Math.max(lastClickedFileIndexRef.current, fileIndex);
      const item = items.find((i) => i.id === itemId);
      if (item) {
        item.files.slice(start, end + 1).forEach((f) => {
          onFileSelect(itemId, f.id, checked);
        });
      }
    } else {
      onFileSelect(itemId, file.id, checked);
    }
    lastClickedFileIndexRef.current = fileIndex;
  };

  const handleFileDownload = async (itemId, fileId, copyLink = false) => {
    if (copyLink) {
      setIsCopying((prev) => ({ ...prev, [fileId]: true }));
    } else {
      setIsDownloading((prev) => ({ ...prev, [fileId]: true }));
    }
    const options = { fileId };

    switch (activeType) {
      case 'usenet':
        await downloadSingle(itemId, options, 'usenet_id', copyLink);
        break;
      case 'webdl':
        await downloadSingle(itemId, options, 'web_id', copyLink);
        break;
      default:
        await downloadSingle(itemId, options, 'torrent_id', copyLink);
    }

    if (copyLink) {
      setIsCopying((prev) => ({ ...prev, [fileId]: false }));
    } else {
      setIsDownloading((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const filteredColumns = activeColumns.filter(
    (column) =>
      ![
        'name',
        'progress',
        'download_state',
        'download_speed',
        'upload_speed',
      ].includes(column),
  );

  const isDisabled = (itemId) => {
    return (
      selectedItems.files?.has(itemId) &&
      selectedItems.files.get(itemId).size > 0
    );
  };

  const getTooltipContent = (column) => {
    switch (column) {
      case 'id':
        return 'ID';
      case 'hash':
        return 'Hash';
      case 'seeds':
        return 'Seeds';
      case 'peers':
        return 'Peers';
      case 'ratio':
        return 'Ratio';
      case 'size':
        return 'Size';
      case 'file_count':
        return 'Files';
      case 'created_at':
        return 'Added';
      case 'updated_at':
        return 'Updated';
      case 'expires_at':
        return 'Expires';
      case 'eta':
        return 'ETA';
      case 'total_downloaded':
        return 'Downloaded';
      case 'total_uploaded':
        return 'Uploaded';
      case 'original_url':
        return 'Source';
    }
  };

  const getColumnIcon = (column) => {
    switch (column) {
      case 'id':
        return Icons.arrow_left_right;
      case 'hash':
        return Icons.hash;
      case 'seeds':
        return Icons.up_arrow;
      case 'peers':
        return Icons.down_arrow;
      case 'ratio':
        return Icons.percent;
      case 'size':
        return Icons.layers;
      case 'file_count':
        return Icons.file;
      case 'created_at':
      case 'updated_at':
      case 'expires_at':
        return Icons.clock;
      case 'eta':
        return Icons.clock_arrow_down;
      case 'total_downloaded':
        return Icons.cloud_download;
      case 'total_uploaded':
        return Icons.cloud_upload;
      case 'original_url':
        return Icons.link;
    }
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
        return timeAgo(item.created_at);
      case 'updated_at':
        return timeAgo(item.updated_at);
      case 'expires_at':
        return timeAgo(item.expires_at);
      case 'eta':
        return timeAgo(item.eta);
      case 'total_downloaded':
        return formatSize(item.total_downloaded);
      case 'total_uploaded':
        return formatSize(item.total_uploaded);
      case 'original_url':
        return item.original_url;
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${isFullscreen ? 'p-4' : 'p-0'}`}>
      {items.map((item, index) => (
        <div
          key={item.id}
          onMouseDown={(e) => {
            // Prevent text selection on shift+click
            if (e.shiftKey) {
              e.preventDefault();
            }
          }}
          onClick={(e) => {
            if (isDisabled(item.id)) return;
            const isChecked = selectedItems.items?.has(item.id);
            handleItemSelection(item.id, !isChecked, index, e.shiftKey);
          }}
          className={`${
            selectedItems.items?.has(item.id)
              ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
              : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
          } px-2 py-4 md:p-4 relative rounded-lg border border-border dark:border-border-dark overflow-hidden cursor-pointer`}
        >
          <div className="flex justify-between gap-2">
            <div className="flex flex-col justify-between gap-2 min-w-0">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedItems.items?.has(item.id)}
                  onChange={(e) =>
                    handleItemSelection(item.id, e.target.checked, index)
                  }
                  onClick={(e) => e.stopPropagation()}
                  disabled={isDisabled(item.id)}
                  className="accent-accent dark:accent-accent-dark flex-shrink-0"
                />
                <h3
                  className={`text-sm sm:text-md md:text-[18px] font-medium break-all text-primary-text dark:text-primary-text-dark flex-1 ${
                    isBlurred ? 'blur-sm select-none' : ''
                  }`}
                >
                  <Tooltip content={item.name || 'Unnamed Item'}>
                    {item.name || 'Unnamed Item'}
                  </Tooltip>
                </h3>
              </div>

              <div
                className={`flex items-center ${
                  isMobile ? 'gap-2' : 'gap-4'
                } text-xs md:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
              >
                <DownloadStateBadge
                  item={item}
                  size={isMobile ? 'xs' : 'default'}
                />
                {!isMobile ? (
                  <>
                    {filteredColumns.map((column) => (
                      <div
                        className="flex items-center gap-1 font-semibold"
                        key={column}
                      >
                        <Tooltip content={getTooltipContent(column)}>
                          <div className="flex items-center gap-1">
                            {getColumnIcon(column)}{' '}
                            {getColumnValue(column, item)}
                          </div>
                        </Tooltip>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <span>{formatSize(item.size || 0)}</span> •{' '}
                    <span>{timeAgo(item.created_at)}</span>
                  </>
                )}
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
                viewMode={viewMode}
              />

              {/* Speed */}
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

          {/* Files Section */}
          {expandedItems.has(item.id) &&
            item.files &&
            item.files.length > 0 && (
              <div className="mt-4 border-t border-border dark:border-border-dark pt-4">
                <div className="space-y-2">
                  {item.files.map((file, fileIndex) => {
                    const isChecked =
                      selectedItems.files.get(item.id)?.has(file.id) || false;
                    const isDisabled = selectedItems.items?.has(item.id);

                    return (
                      <div
                        key={`${item.id}-${file.id}`}
                        className={`${
                          isChecked
                            ? 'bg-accent/15 hover:bg-accent/20 dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
                            : isDisabled
                              ? 'bg-surface-alt-selected dark:bg-surface-alt-selected-dark'
                              : 'bg-accent/5 hover:bg-accent/10 dark:bg-surface-alt-dark/70 dark:hover:bg-surface-alt-selected-hover-dark/70'
                        } rounded-md p-2 ${!isDisabled && 'cursor-pointer'}`}
                        onMouseDown={(e) => {
                          if (e.shiftKey) e.preventDefault();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.target.closest('button') || isDisabled) return;
                          handleFileSelection(
                            item.id,
                            fileIndex,
                            file,
                            !isChecked,
                            e.shiftKey,
                          );
                        }}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={isDisabled}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleFileSelection(
                                  item.id,
                                  fileIndex,
                                  file,
                                  e.target.checked,
                                  e.shiftKey,
                                );
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="accent-accent dark:accent-accent-dark"
                            />
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                              <span
                                className={`text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate ${
                                  isBlurred ? 'blur-sm select-none' : ''
                                }`}
                                title={isBlurred ? '' : file.name}
                              >
                                {file.short_name || file.name}
                              </span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70">
                                  {formatSize(file.size || 0)}
                                </span>
                                {file.mimetype && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 text-accent dark:text-accent-dark">
                                    {file.mimetype}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileDownload(item.id, file.id, true);
                              }}
                              disabled={isCopying[file.id]}
                              className="p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                            >
                              {isCopying[file.id] ? (
                                <Spinner size="sm" />
                              ) : (
                                Icons.copy
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileDownload(item.id, file.id);
                              }}
                              disabled={isDownloading[file.id]}
                              className="p-1.5 rounded-full text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                              title="Download File"
                            >
                              {isDownloading[file.id] ? (
                                <Spinner size="sm" />
                              ) : (
                                Icons.download
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Progress bar */}
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
      ))}
    </div>
  );
}
