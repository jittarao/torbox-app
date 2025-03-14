'use client';

import Icons from '@/components/icons';
import { formatSize } from './utils/formatters';
import Spinner from '@/components/shared/Spinner';
import Tooltip from '@/components/shared/Tooltip';
import { useTranslations } from 'next-intl';
export default function FileRow({
  item,
  selectedItems,
  handleFileSelection,
  handleFileDownload,
  activeColumns,
  downloadHistory,
  isCopying,
  isDownloading,
  isMobile = false,
  isBlurred = false,
}) {
  const t = useTranslations('FileActions');
  const assetKey = (itemId, fileId) =>
    fileId ? `${itemId}-${fileId}` : itemId;

  return (
    <>
      {item.files.map((file, index) => {
        const isChecked =
          selectedItems.files.get(item.id)?.has(file.id) || false;
        const isDisabled = selectedItems.items?.has(item.id);
        const isDownloaded = downloadHistory.some(
          (download) =>
            download.itemId === item.id && download.fileId === file.id,
        );

        return (
          <tr
            key={`${item.id}-${file.id}`}
            className={`border-accent/5 dark:border-accent-dark/5 ${
              isChecked
                ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
                : isDownloaded
                  ? 'bg-downloaded dark:bg-downloaded-dark hover:bg-downloaded-hover dark:hover:bg-downloaded-hover-dark'
                  : 'bg-surface dark:bg-surface-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark'
            } transition-colors ${!isDisabled && 'cursor-pointer'}`}
            onMouseDown={(e) => {
              // Prevent text selection on shift+click
              if (e.shiftKey) {
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              // Ignore clicks on buttons or if disabled
              if (e.target.closest('button') || isDisabled) return;
              handleFileSelection(item.id, index, file, !isChecked, e.shiftKey);
            }}
          >
            <td className="px-3 md:px-4 py-2 text-center whitespace-nowrap">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) =>
                  handleFileSelection(
                    item.id,
                    index,
                    file,
                    e.target.checked,
                    e.shiftKey,
                  )
                }
                style={{ pointerEvents: 'none' }}
                className="accent-accent dark:accent-accent-dark"
              />
            </td>
            <td
              className="pl-3 md:pl-6 py-2"
              colSpan={isMobile ? 1 : activeColumns.length}
            >
              <div
                className={`${isMobile ? 'grid grid-cols-1 gap-1' : 'grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4'}`}
              >
                <span
                  className={`text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate max-w-[250px] md:max-w-md ${isBlurred ? 'blur-sm select-none' : ''}`}
                >
                  <Tooltip
                    content={isBlurred ? '' : file.short_name || file.name}
                  >
                    {file.short_name || file.name}
                  </Tooltip>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark 
                    text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap"
                  >
                    {formatSize(file.size || 0)}
                  </span>
                  {file.mimetype && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 
                      text-accent dark:text-accent-dark whitespace-nowrap"
                    >
                      {file.mimetype}
                    </span>
                  )}
                </div>
              </div>
            </td>
            <td className="px-3 md:px-4 py-2 whitespace-nowrap text-right sticky right-0 z-10 bg-inherit dark:bg-inherit">
              {/* Copy link button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload(item.id, file.id, true);
                }}
                disabled={isCopying[assetKey(item.id, file.id)]}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                title={t('copyLink')}
              >
                {isCopying[assetKey(item.id, file.id)] ? (
                  <Spinner size="sm" />
                ) : (
                  <Icons.Copy />
                )}
              </button>

              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload(item.id, file.id);
                }}
                disabled={isDownloading[assetKey(item.id, file.id)]}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                title={t('download')}
              >
                {isDownloading[assetKey(item.id, file.id)] ? (
                  <Spinner size="sm" />
                ) : (
                  <Icons.Download />
                )}
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
