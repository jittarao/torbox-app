'use client';

import {
  formatSize,
  formatSpeed,
  formatEta,
  timeAgo,
  formatDate,
} from './utils/formatters';
import DownloadStateBadge from './DownloadStateBadge';
import ItemActions from './ItemActions';

export default function ItemRow({
  item,
  activeColumns,
  selectedItems,
  setSelectedItems,
  setItems,
  onRowSelect,
  hoveredItem,
  setHoveredItem,
  expandedItems,
  toggleFiles,
  apiKey,
  onDelete,
  rowIndex,
  items,
  lastClickedItemIndexRef,
  setToast,
  activeType = 'torrents',
  isMobile = false,
  isBlurred = false,
  viewMode = 'table',
}) {
  const handleItemSelection = (checked, isShiftKey = false) => {
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
          if (checked) {
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
        if (checked) {
          newItems.add(item.id);
        } else {
          newItems.delete(item.id);
        }
        return {
          items: newItems,
          files: prev.files,
        };
      });
    }
    lastClickedItemIndexRef.current = rowIndex;
  };

  const renderCell = (columnId) => {
    const baseStyle = {};

    switch (columnId) {
      case 'name':
        return (
          <td
            key={columnId}
            className="px-3 md:px-4 py-4 max-w-[150px] md:max-w-md relative"
            style={baseStyle}
          >
            <div
              className={`text-sm text-primary-text dark:text-primary-text-dark ${
                isMobile ? 'break-all' : 'whitespace-nowrap truncate'
              } flex-1 cursor-pointer ${isBlurred ? 'blur-sm select-none' : ''}`}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              {item.name || 'Unnamed Item'}
              {hoveredItem === item.id && item.name && !isBlurred && (
                <div className="absolute z-10 left-0 top-full mt-2 p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-lg max-w-[250px] md:max-w-xl break-words whitespace-normal">
                  {item.name}
                </div>
              )}
            </div>
            {/* Show additional info on mobile */}
            {isMobile && (
              <div className="flex flex-col mt-1 text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                <div className="flex flex-col items-start gap-2">
                  {item.download_state && (
                    <DownloadStateBadge item={item} size="xs" />
                  )}
                  <span>{formatSize(item.size || 0)}</span>
                  {item.created_at && <span>{timeAgo(item.created_at)}</span>}
                </div>
              </div>
            )}
          </td>
        );
      case 'size':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {formatSize(item.size || 0)}
          </td>
        );
      case 'created_at':
      case 'updated_at':
      case 'expires_at':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 relative group"
            style={baseStyle}
          >
            <div className="cursor-default">
              {item[columnId] ? (
                <>
                  <span>{timeAgo(item[columnId])}</span>
                  <div className="invisible group-hover:visible absolute z-10 left-0 top-full mt-2 p-2 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded shadow-lg">
                    {formatDate(item[columnId])}
                  </div>
                </>
              ) : (
                'Unknown'
              )}
            </div>
          </td>
        );
      case 'download_state':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap"
            style={baseStyle}
          >
            <DownloadStateBadge item={item} />
          </td>
        );
      case 'progress':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${(item.progress || 0) * 100}%` }}
              ></div>
            </div>
            <span className="text-xs">
              {((item.progress || 0) * 100).toFixed(1)}%
            </span>
          </td>
        );
      case 'ratio':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {(item.ratio || 0).toFixed(2)}
          </td>
        );
      case 'download_speed':
      case 'upload_speed':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {formatSpeed(item[columnId])}
          </td>
        );
      case 'eta':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {formatEta(item.eta)}
          </td>
        );
      case 'id':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {item.id}
          </td>
        );
      case 'total_uploaded':
      case 'total_downloaded':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {formatSize(item[columnId] || 0)}
          </td>
        );
      case 'seeds':
      case 'peers':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {item[columnId] || 0}
          </td>
        );
      case 'file_count':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {item.files?.length || 0}
          </td>
        );
      case 'error':
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-red-500"
            style={baseStyle}
          >
            {item.error || ''}
          </td>
        );
      default:
        return (
          <td
            key={columnId}
            className="px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70"
            style={baseStyle}
          >
            {item[columnId]}
          </td>
        );
    }
  };

  // For mobile, we'll only show the name column
  const visibleColumns = isMobile ? ['name'] : activeColumns;

  return (
    <tr
      className={`${
        selectedItems.items?.has(item.id)
          ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
      } ${!onRowSelect(item.id, selectedItems.files) && 'cursor-pointer'}`}
      onMouseDown={(e) => {
        // Prevent text selection on shift+click
        if (e.shiftKey) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        // Ignore clicks on buttons or if has selected files
        if (
          e.target.closest('button') ||
          onRowSelect(item.id, selectedItems.files)
        )
          return;
        const isChecked = selectedItems.items?.has(item.id);
        handleItemSelection(!isChecked, e.shiftKey);
      }}
    >
      <td className="px-3 md:px-4 py-4 text-center whitespace-nowrap">
        <input
          type="checkbox"
          checked={selectedItems.items?.has(item.id)}
          disabled={onRowSelect(item.id, selectedItems.files)}
          onChange={(e) => handleItemSelection(e.target.checked, e.shiftKey)}
          style={{ pointerEvents: 'none' }}
          className="accent-accent dark:accent-accent-dark"
        />
      </td>
      {visibleColumns.map((columnId) => renderCell(columnId))}
      <td className="px-3 md:px-4 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-inherit dark:bg-inherit">
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
        />
      </td>
    </tr>
  );
}
