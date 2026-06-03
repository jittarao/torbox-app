import { memo } from 'react';
import { Copy, Download, Times } from '@/components/icons';
import { getExpirationDate } from '../utils/formatters';

const LinkHistoryRow = memo(
  ({
    item,
    isSelected,
    onSelect,
    rowIndex,
    onCopy,
    onDelete,
    onOpen,
    deleting,
    isMobile,
    t,
    linkHistoryT,
  }) => {
    const isFailed = item.status === 'failed';
    const expirationDate = isFailed
      ? linkHistoryT('status.failed')
      : getExpirationDate(item.generated_at, t, linkHistoryT);

    return (
      <tr
        className={
          isFailed
            ? 'bg-link-failed hover:bg-link-failed-hover dark:bg-link-failed-dark dark:hover:bg-link-failed-hover-dark'
            : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
        }
      >
        <td className="px-2.5 md:px-3 py-1.5 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isSelected}
            onMouseDown={(e) => {
              if (e.shiftKey) e.preventDefault();
            }}
            onChange={(e) =>
              onSelect(item.id, e.target.checked, rowIndex, e.shiftKey)
            }
            className="size-4 accent-accent dark:accent-accent-dark cursor-pointer"
            aria-label={linkHistoryT('actions.selectItem')}
          />
        </td>
        <td className="px-2.5 md:px-3 py-1.5 whitespace-nowrap text-xs text-primary-text/70 dark:text-primary-text-dark/70">
          {item.item_id}
        </td>
        <td className="px-2.5 md:px-3 py-1.5 whitespace-nowrap text-xs text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
          {item.item_name || '-'}
        </td>
        <td className="px-2.5 md:px-3 py-1.5 whitespace-nowrap text-xs text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
          {item.file_name || '-'}
        </td>
        <td className="px-2.5 md:px-3 py-1.5 whitespace-nowrap text-xs text-primary-text/70 dark:text-primary-text-dark/70">
          {expirationDate}
        </td>
        <td
          className={`px-2.5 md:px-3 py-1.5 whitespace-nowrap text-right text-xs font-medium sticky right-0 z-10 bg-inherit dark:bg-inherit flex ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-1.5`}
        >
          <button
            type="button"
            onClick={() => onCopy(item.url)}
            disabled={isFailed}
            className={`p-1 rounded-full text-accent dark:text-accent-dark 
              hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
              disabled:opacity-40 disabled:pointer-events-none
              ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
            title={linkHistoryT('actions.copy')}
            aria-label={linkHistoryT('actions.copy')}
          >
            {isMobile ? (
              <div className="flex items-center justify-center gap-2">
                <Copy /> {linkHistoryT('actions.copy')}
              </div>
            ) : (
              <Copy />
            )}
          </button>
          <button
            type="button"
            onClick={() => onOpen(item.url)}
            disabled={isFailed}
            className={`p-1 rounded-full text-accent dark:text-accent-dark 
              hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
              disabled:opacity-40 disabled:pointer-events-none
              ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
            title={linkHistoryT('actions.download')}
            aria-label={linkHistoryT('actions.download')}
          >
            {isMobile ? (
              <div className="flex items-center justify-center gap-2">
                <Download /> {linkHistoryT('actions.download')}
              </div>
            ) : (
              <Download />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            disabled={deleting}
            className={`p-1 rounded-full text-red-500 dark:text-red-400 
              hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
              disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
            title={linkHistoryT('actions.remove')}
            aria-label={linkHistoryT('actions.remove')}
          >
            {isMobile ? (
              <div className="flex items-center justify-center gap-2">
                <Times /> {linkHistoryT('actions.remove')}
              </div>
            ) : (
              <Times />
            )}
          </button>
        </td>
      </tr>
    );
  }
);

LinkHistoryRow.displayName = 'LinkHistoryRow';

export default LinkHistoryRow;
