import { formatSize, formatSpeed, timeAgo } from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';
import { useRef } from 'react';
import useIsMobile from '@/hooks/useIsMobile';

export default function CardList({
  items,
  selectedItems,
  setSelectedItems,
  setItems,
  apiKey,
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

  const isDisabled = (itemId) => {
    return (
      selectedItems.files?.has(itemId) &&
      selectedItems.files.get(itemId).size > 0
    );
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
                  {item.name || 'Unnamed Item'}
                </h3>
              </div>

              <div
                className={`flex items-center ${
                  isMobile ? 'gap-2' : 'gap-4'
                } text-xs md:text-sm text-primary-text/70 dark:text-primary-text-dark/70`}
              >
                <DownloadStateBadge item={item} />
                {!isMobile ? (
                  <>
                    <span>Seeds: {item.seeds}</span>
                    <span>Peers: {item.peers}</span>
                    <span>Ratio: {item.ratio}</span>
                    <span>Size: {formatSize(item.size || 0)}</span>
                    <span>Added: {timeAgo(item.created_at)}</span>
                  </>
                ) : (
                  <>
                    <span>{formatSize(item.size || 0)}</span> •{' '}
                    <span>{timeAgo(item.created_at)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col items-start justify-between gap-2 flex-shrink-0">
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

          {/* Progress bar */}
          {item.progress < 1 && item.active && (
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
