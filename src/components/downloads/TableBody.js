'use client';

import { useState, useRef, useMemo, useDeferredValue } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import ItemRow from './ItemRow';
import FileRow from './FileRow';
import { useDownloads } from '../shared/hooks/useDownloads';
import useIsMobile from '@/hooks/useIsMobile';
import { useTranslations } from 'next-intl';

export default function TableBody({
  items,
  setItems,
  activeColumns,
  columnWidths,
  selectedItems,
  onRowSelect,
  onFileSelect,
  setSelectedItems,
  downloadHistory,
  setDownloadHistory,
  expandedItems,
  toggleFiles,
  apiKey,
  onDelete,
  setToast,
  activeType = 'torrents',
  isBlurred = false,
  viewMode = 'table',
  tableWidth,
}) {
  const t = useTranslations('TableBody');

  // Shared ref for tracking last clicked item row index
  const lastClickedItemIndexRef = useRef(null);
  const lastClickedFileIndexRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState({});
  const [isCopying, setIsCopying] = useState({});
  const { downloadSingle } = useDownloads(
    apiKey,
    activeType,
    downloadHistory,
    setDownloadHistory,
  );
  const isMobile = useIsMobile();
  const tbodyRef = useRef(null);

  // Defer items update to prevent synchronous updates during render
  const deferredItems = useDeferredValue(items);
  const deferredExpandedItems = useDeferredValue(expandedItems);

  // Create flattened array of rows (item rows + file rows when expanded)
  const flattenedRows = useMemo(() => {
    const rows = [];
    deferredItems.forEach((item, itemIndex) => {
      // Add item row
      rows.push({
        type: 'item',
        item,
        itemIndex,
        virtualIndex: rows.length,
      });

      // Add file rows if expanded
      if (deferredExpandedItems.has(item.id) && item.files && item.files.length > 0) {
        item.files.forEach((file, fileIndex) => {
          rows.push({
            type: 'file',
            item,
            file,
            itemIndex,
            fileIndex,
            virtualIndex: rows.length,
          });
        });
      }
    });
    return rows;
  }, [deferredItems, deferredExpandedItems]);

  // Find scrollable parent container (the div with id="items-table")
  const getScrollElement = () => {
    if (typeof document !== 'undefined') {
      return document.getElementById('items-table');
    }
    return null;
  };

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: flattenedRows.length,
    getScrollElement,
    estimateSize: (index) => {
      const row = flattenedRows[index];
      // Height estimates for mobile vs desktop
      // Mobile rows are much taller due to vertical action layout and extra info
      if (isMobile) {
        return row.type === 'item' ? 170 : 60;
      }
      // Desktop estimates
      return row.type === 'item' ? 70 : 50;
    },
    measureElement: (element) => {
      // Measure the actual rendered height of the row
      // Add a small buffer for borders/spacing
      return element.getBoundingClientRect().height + 1;
    },
    overscan: 5,
  });

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

  const assetKey = (itemId, fileId) =>
    fileId ? `${itemId}-${fileId}` : itemId;

  const handleFileDownload = async (itemId, file, copyLink = false) => {
    const key = assetKey(itemId, file.id);
    if (copyLink) {
      setIsCopying((prev) => ({ ...prev, [key]: true }));
    } else {
      setIsDownloading((prev) => ({ ...prev, [key]: true }));
    }
    const options = { fileId: file.id, filename: file.name };

    const idField =
      activeType === 'usenet'
        ? 'usenet_id'
        : activeType === 'webdl'
          ? 'web_id'
          : 'torrent_id';

    const metadata = {
      assetType: activeType,
      item: items.find((item) => item.id === itemId),
    };

    await downloadSingle(itemId, options, idField, copyLink, metadata)
      .then(() => {
        setToast({
          message: t('toast.copyLink'),
          type: 'success',
        });
      })
      .catch((err) => {
        setToast({
          message: t('toast.copyLinkFailed'),
          type: 'error',
        });
      })
      .finally(() => {
        if (copyLink) {
          setIsCopying((prev) => ({ ...prev, [key]: false }));
        } else {
          setIsDownloading((prev) => ({ ...prev, [key]: false }));
        }
      });
  };

  const isDisabled = (itemId) => {
    return (
      selectedItems.files?.has(itemId) &&
      selectedItems.files.get(itemId).size > 0
    );
  };

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const startOffset = virtualRows[0]?.start ?? 0;

  // Show empty state when there are no items
  if (deferredItems.length === 0) {
    return (
      <tbody
        ref={tbodyRef}
        className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark"
      >
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            className="text-center py-8 text-text-secondary dark:text-text-secondary-dark"
          >
            {t('noDownloads')}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody
      ref={tbodyRef}
      className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark"
    >
      {/* Top spacer */}
      {startOffset > 0 && (
        <tr>
          <td colSpan={activeColumns.length + 2} style={{ height: startOffset, padding: 0 }} />
        </tr>
      )}
      {/* Virtualized rows */}
      {virtualRows.map((virtualRow) => {
        const row = flattenedRows[virtualRow.index];

        if (row.type === 'item') {
          return (
            <ItemRow
              key={`item-${row.item.id}`}
              item={row.item}
              activeColumns={activeColumns}
              columnWidths={columnWidths}
              selectedItems={selectedItems}
              setItems={setItems}
              setSelectedItems={setSelectedItems}
              downloadHistory={downloadHistory}
              setDownloadHistory={setDownloadHistory}
              onRowSelect={onRowSelect}
              expandedItems={expandedItems}
              toggleFiles={toggleFiles}
              apiKey={apiKey}
              onDelete={onDelete}
              rowIndex={row.itemIndex}
              handleItemSelection={handleItemSelection}
              setToast={setToast}
              activeType={activeType}
              isMobile={isMobile}
              isBlurred={isBlurred}
              viewMode={viewMode}
              tableWidth={tableWidth}
              measureRef={virtualizer.measureElement}
              dataIndex={virtualRow.index}
            />
          );
        } else {
          // File row - use FileRow component to render the specific file
          return (
            <FileRow
              key={`file-${row.item.id}-${row.file.id}`}
              item={row.item}
              selectedItems={selectedItems}
              handleFileSelection={handleFileSelection}
              handleFileDownload={handleFileDownload}
              activeColumns={activeColumns}
              downloadHistory={downloadHistory}
              isCopying={isCopying}
              isDownloading={isDownloading}
              isMobile={isMobile}
              isBlurred={isBlurred}
              tableWidth={tableWidth}
              fileIndex={row.fileIndex}
              measureRef={virtualizer.measureElement}
              dataIndex={virtualRow.index}
            />
          );
        }
      })}
      {/* Bottom spacer */}
      {virtualRows.length > 0 && (
        <tr>
          <td
            colSpan={activeColumns.length + 2}
            style={{
              height: totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0),
              padding: 0,
            }}
          />
        </tr>
      )}
    </tbody>
  );
}
