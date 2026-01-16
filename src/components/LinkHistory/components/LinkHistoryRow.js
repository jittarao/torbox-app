import { memo } from 'react';
import Icons from '@/components/icons';
import { getExpirationDate } from '../utils/formatters';

const LinkHistoryRow = memo(({ item, isSelected, onSelect, onCopy, onDelete, onOpen, deleting, isMobile, t, linkHistoryT }) => {
  const expirationDate = getExpirationDate(item.generated_at, t, linkHistoryT);

  return (
    <tr className="bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark">
      <td className="px-3 md:px-4 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelect(item.id, e.target.checked)}
          className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
        />
      </td>
      <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {item.item_id}
      </td>
      <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
        {item.item_name || '-'}
      </td>
      <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70 max-w-[200px] overflow-hidden text-ellipsis">
        {item.file_name || '-'}
      </td>
      <td className="px-3 md:px-4 py-4 whitespace-nowrap text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {expirationDate}
      </td>
      <td
        className={`px-3 md:px-4 py-4 whitespace-nowrap text-right text-sm font-medium sticky right-0 z-10 bg-inherit dark:bg-inherit flex ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-2`}
      >
        <button
          onClick={() => onCopy(item.url)}
          className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
              hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
              ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={linkHistoryT('actions.copy')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Icons.Copy /> {linkHistoryT('actions.copy')}
            </div>
          ) : (
            <Icons.Copy />
          )}
        </button>
        <button
          onClick={() => onOpen(item.url)}
          className={`p-1.5 rounded-full text-accent dark:text-accent-dark 
              hover:bg-accent/5 dark:hover:bg-accent-dark/5 transition-colors
              ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={linkHistoryT('actions.download')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Icons.Download /> {linkHistoryT('actions.download')}
            </div>
          ) : (
            <Icons.Download />
          )}
        </button>
        <button
          onClick={() => onDelete(item.id)}
          disabled={deleting}
          className={`p-1.5 rounded-full text-red-500 dark:text-red-400 
              hover:bg-red-500/5 dark:hover:bg-red-400/5 transition-all duration-200
              disabled:opacity-50 ${isMobile ? 'w-full flex items-center justify-center py-1 rounded-md' : ''}`}
          title={linkHistoryT('actions.remove')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Icons.Times /> {linkHistoryT('actions.remove')}
            </div>
          ) : (
            <Icons.Times />
          )}
        </button>
      </td>
    </tr>
  );
});

LinkHistoryRow.displayName = 'LinkHistoryRow';

export default LinkHistoryRow;
