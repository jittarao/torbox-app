import { memo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import LinkHistoryRow from './LinkHistoryRow';

const LinkHistoryTable = memo(({ 
  history, 
  selectedLinks, 
  onSelectAll, 
  onSelectLink, 
  onCopy, 
  onDelete, 
  onOpen,
  deleting,
  isMobile,
  allSelected,
  someSelected 
}) => {
  const linkHistoryT = useTranslations('LinkHistory');
  const t = useTranslations('Common');
  const checkboxRef = useRef(null);

  // Set indeterminate state on checkbox
  if (checkboxRef.current) {
    checkboxRef.current.indeterminate = someSelected;
  }

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
      <table className="min-w-full table-fixed divide-y divide-border dark:divide-border-dark relative">
        <thead className="bg-surface-alt dark:bg-surface-alt-dark">
          <tr className="table-rowbg-surface-alt dark:bg-surface-alt-dark">
            <th className="text-left px-3 md:px-4 py-3 text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase w-12">
              <input
                ref={checkboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="w-4 h-4 accent-accent dark:accent-accent-dark cursor-pointer"
              />
            </th>
            <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[120px] min-w-[120px] max-w-[150px]">
              {linkHistoryT('columns.itemId')}
            </th>
            <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
              {linkHistoryT('columns.itemName')}
            </th>
            <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
              {linkHistoryT('columns.fileName')}
            </th>
            <th className="relative group select-none px-3 md:px-4 py-3 text-left text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase cursor-pointer hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors w-[200px] min-w-[200px] max-w-[200px]">
              {linkHistoryT('columns.expiresAt')}
            </th>
            <th className="px-3 md:px-4 py-3 text-right text-xs font-medium text-primary-text dark:text-primary-text-dark uppercase sticky right-0 bg-surface-alt dark:bg-surface-alt-dark w-[100px] min-w-[100px] max-w-[150px]">
              {linkHistoryT('columns.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface dark:bg-surface-dark divide-y divide-border dark:divide-border-dark">
          {history.map((item) => (
            <LinkHistoryRow
              key={item.id}
              item={item}
              isSelected={selectedLinks.has(item.id)}
              onSelect={onSelectLink}
              onCopy={onCopy}
              onDelete={onDelete}
              onOpen={onOpen}
              deleting={deleting}
              isMobile={isMobile}
              t={t}
              linkHistoryT={linkHistoryT}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
});

LinkHistoryTable.displayName = 'LinkHistoryTable';

export default LinkHistoryTable;
