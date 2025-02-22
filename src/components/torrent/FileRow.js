'use client';
import { useRef } from 'react';
import { Icons } from './constants';
import { formatSize } from './utils/formatters';
import { useDownloads } from './hooks/useDownloads';

export default function FileRow({
  torrent,
  selectedItems,
  onFileSelect,
  apiKey,
  activeColumns
}) {
  // Track last clicked file index for shift selection
  const lastClickedFileIndexRef = useRef(null);
  const { downloadSingle } = useDownloads(apiKey);

  const handleFileSelection = (index, file, checked, isShiftKey = false) => {
    if (isShiftKey && lastClickedFileIndexRef.current !== null) {
      const start = Math.min(lastClickedFileIndexRef.current, index);
      const end = Math.max(lastClickedFileIndexRef.current, index);
      torrent.files.slice(start, end + 1).forEach(f => {
        onFileSelect(torrent.id, f.id, checked);
      });
    } else {
      onFileSelect(torrent.id, file.id, checked);
    }
    lastClickedFileIndexRef.current = index;
  };

  const handleFileDownload = async (torrentId, fileId) => {
    await downloadSingle(torrentId, { fileId });
  };

  return (
    <>
      {torrent.files.map((file, index) => {
        const isChecked = selectedItems.files.get(torrent.id)?.has(file.id) || false;
        const isDisabled = selectedItems.torrents.has(torrent.id);
        
        return (
          <tr 
            key={`${torrent.id}-${file.id}`} 
            className={`border-accent/5 dark:border-accent-dark/5 ${
              isChecked 
                ? 'bg-surface-alt/60 hover:bg-surface-alt/90 dark:bg-accent-dark/5 dark:hover:bg-accent-dark/10' 
                : 'hover:bg-surface-alt/30 dark:bg-surface-alt-dark/30 dark:hover:bg-surface-alt-dark/90'
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
            <td className="px-6 py-2 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled}
                onChange={(e) => handleFileSelection(index, file, e.target.checked, e.shiftKey)}
                style={{ pointerEvents: 'none' }}
                className="accent-accent dark:accent-accent-dark"
              />
            </td>
            <td className="pl-6 py-2" colSpan={activeColumns.length}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4">
                <span className="text-sm font-medium text-primary-text dark:text-primary-text-dark truncate" 
                  title={file.name}>
                  {file.short_name || file.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-alt dark:bg-surface-alt-dark 
                  text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap">
                  {formatSize(file.size || 0)}
                </span>
                {file.mimetype && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/5 dark:bg-accent-dark/5 
                    text-accent dark:text-accent-dark whitespace-nowrap">
                    {file.mimetype}
                  </span>
                )}
              </div>
            </td>
            <td className="px-6 py-2 whitespace-nowrap text-right">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload(torrent.id, file.id);
                }}
                className="p-1.5 rounded-full text-accent dark:text-accent-dark 
                  hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors"
                title="Download File"
              >
                {Icons.download}
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
} 