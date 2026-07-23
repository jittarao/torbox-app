import { Copy, Restore, Times } from '@/components/icons';
import TimeAgoWithTooltip from '@/components/shared/TimeAgoWithTooltip';

function ArchivedDownloadsRow({
  item,
  rowIndex,
  isSelected,
  isMobile,
  archivedT,
  t,
  onSelectItem,
  onRestore,
  onCopyMagnet,
  onRemove,
}) {
  const handleRowSelect = (shiftKey) => {
    onSelectItem(item.archiveId, !isSelected, rowIndex, shiftKey);
  };

  return (
    <tr
      aria-selected={isSelected}
      className={`cursor-pointer ${
        isSelected
          ? 'bg-surface-alt-selected hover:bg-surface-alt-selected-hover dark:bg-surface-alt-selected-dark dark:hover:bg-surface-alt-selected-hover-dark'
          : 'bg-surface hover:bg-surface-alt-hover dark:bg-surface-dark dark:hover:bg-surface-alt-hover-dark'
      }`}
      onMouseDown={(e) => {
        if (e.shiftKey) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target.closest('button')) return;
        handleRowSelect(e.shiftKey);
      }}
    >
      <td className="px-2.5 py-1.5 md:px-3">
        <input
          type="checkbox"
          checked={isSelected}
          readOnly
          tabIndex={-1}
          style={{ pointerEvents: 'none' }}
          className="size-4 accent-accent dark:accent-accent-dark"
          aria-label={archivedT('actions.selectItem')}
        />
      </td>
      <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
        {item.id}
      </td>
      <td className="max-w-[200px] truncate px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
        {item.name}
      </td>
      <td className="whitespace-nowrap px-2.5 py-1.5 text-xs text-primary-text/70 dark:text-primary-text-dark/70 md:px-3">
        <TimeAgoWithTooltip at={item.archivedAt} t={t} />
      </td>
      <td
        className={`sticky right-0 z-10 flex bg-inherit px-2.5 py-1.5 text-right text-xs font-medium dark:bg-inherit md:px-3 ${isMobile ? 'flex-col' : 'flex-row'} items-center justify-end gap-1.5 whitespace-nowrap`}
      >
        <button
          type="button"
          onClick={() => onRestore(item)}
          className={`rounded-full p-1 text-green-500 transition-all duration-200 hover:bg-green-500/5 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-400/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
          title={archivedT('actions.addToTorBox')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Restore /> {archivedT('actions.addToTorBox')}
            </div>
          ) : (
            <Restore />
          )}
        </button>

        <button
          type="button"
          onClick={() => onCopyMagnet(item)}
          className={`rounded-full p-1 text-blue-500 transition-all duration-200 hover:bg-label-active-text/5 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-label-active-text-dark/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
          title={archivedT('actions.copyMagnet')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Copy /> {archivedT('actions.copyMagnet')}
            </div>
          ) : (
            <Copy className="size-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className={`rounded-full p-1 text-red-500 transition-all duration-200 hover:bg-red-500/5 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-400/5 ${isMobile ? 'flex w-full items-center justify-center rounded-md py-1' : ''}`}
          title={archivedT('actions.remove')}
        >
          {isMobile ? (
            <div className="flex items-center justify-center gap-2">
              <Times /> {archivedT('actions.remove')}
            </div>
          ) : (
            <Times />
          )}
        </button>
      </td>
    </tr>
  );
}

export default function ArchivedDownloadsTable({
  archivedItems,
  selectedItems,
  selectAllRef,
  allSelected,
  someSelected,
  isMobile,
  archivedT,
  t,
  onSelectAll,
  onSelectItem,
  onRestore,
  onCopyMagnet,
  onRemove,
}) {
  if (selectAllRef.current) {
    selectAllRef.current.indeterminate = someSelected;
  }

  return (
    <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-border dark:border-border-dark">
      <table className="relative min-w-full table-fixed divide-y divide-border dark:divide-border-dark">
        <thead className="bg-surface-alt dark:bg-surface-alt-dark">
          <tr className="table-rowbg-surface-alt dark:bg-surface-alt-dark">
            <th className="w-12 px-3 py-2 text-left text-xs font-medium uppercase text-primary-text dark:text-primary-text-dark md:px-4">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="size-4 cursor-pointer accent-accent dark:accent-accent-dark"
                aria-label={archivedT('actions.selectItem')}
              />
            </th>
            <th className="relative group w-[120px] min-w-[120px] max-w-[150px] cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
              {archivedT('columns.itemId')}
            </th>
            <th className="relative group cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
              {archivedT('columns.itemName')}
            </th>
            <th className="relative group w-[200px] min-w-[200px] max-w-[200px] cursor-pointer select-none px-2.5 py-2 text-left text-xs font-medium uppercase text-primary-text transition-colors hover:bg-surface-hover dark:text-primary-text-dark dark:hover:bg-surface-hover-dark md:px-3">
              {archivedT('columns.archivedAt')}
            </th>
            <th className="sticky right-0 w-[100px] min-w-[100px] max-w-[150px] bg-surface-alt px-2.5 py-2 text-right text-xs font-medium uppercase text-primary-text dark:bg-surface-alt-dark dark:text-primary-text-dark md:px-3">
              {archivedT('columns.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface dark:divide-border-dark dark:bg-surface-dark">
          {archivedItems.map((item, rowIndex) => (
            <ArchivedDownloadsRow
              key={item.archiveId}
              item={item}
              rowIndex={rowIndex}
              isSelected={selectedItems.has(item.archiveId)}
              isMobile={isMobile}
              archivedT={archivedT}
              t={t}
              onSelectItem={onSelectItem}
              onRestore={onRestore}
              onCopyMagnet={onCopyMagnet}
              onRemove={onRemove}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
