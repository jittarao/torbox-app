'use client';
import { useRef, useState } from 'react';
import { Icons } from '@/components/constants';
import { formatSize } from './utils/formatters';
import { useDownloads } from '../shared/hooks/useDownloads';
import Spinner from '../shared/Spinner';

export default function FileRow({
  item,
  selectedItems,
  onFileSelect,
  apiKey,
  activeColumns,
  activeType = 'torrents',
  isMobile = false,
}) {
  // Track last clicked file index for shift selection
  const lastClickedFileIndexRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const { downloadSingle } = useDownloads(apiKey, activeType);

  const handleFileSelection = (index, file, checked, isShiftKey = false) => {
    if (isShiftKey && lastClickedFileIndexRef.current !== null) {
      const start = Math.min(lastClickedFileIndexRef.current, index);
      const end = Math.max(lastClickedFileIndexRef.current, index);
      item.files.slice(start, end + 1).forEach((f) => {
        onFileSelect(item.id, f.id, checked);
      });
    } else {
      onFileSelect(item.id, file.id, checked);
    }
    lastClickedFileIndexRef.current = index;
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

  return (
    <>
      {item.files.map((file, index) => {
        const isChecked =
          selectedItems.files.get(item.id)?.has(file.id) || false;
        const isDisabled = selectedItems.items?.has(item.id);

        return (
          <tr
            key={`${item.id}-${file.id}`}
            className={`border-accent/5 dark:border-accent-dark/5 ${
              isChecked
                ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
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
              handleFileSelection(index, file, !isChecked, e.shiftKey);
            }}
          >
            <td className="px-3 md:px-6 py-2 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) =>
                  handleFileSelection(index, file, e.target.checked, e.shiftKey)
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
                  className="text-sm text-primary-text/70 dark:text-primary-text-dark/70 truncate max-w-[150px] md:max-w-md"
                  title={file.name}
                >
                  {file.short_name || file.name}
                </span>
                <div className={`${isMobile ? 'flex items-center gap-2' : ''}`}>
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
            <td className="px-3 md:px-6 py-2 whitespace-nowrap text-right sticky right-0 z-10 bg-inherit dark:bg-inherit">
              {/* Copy link button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload(item.id, file.id, true);
                }}
                disabled={isCopying[file.id]}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
              >
                {isCopying[file.id] ? <Spinner size="sm" /> : Icons.copy}
              </button>

              {/* Download button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload(item.id, file.id);
                }}
                disabled={isDownloading[file.id]}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                title="Download File"
              >
                {isDownloading[file.id] ? (
                  <Spinner size="sm" />
                ) : (
                  Icons.download
                )}
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}
