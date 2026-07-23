import { memo, useId } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Refresh, Trash } from '@/components/icons';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactSearchInputClass, compactToolbarClass } from '@/components/shared/compactToolbar';

const SearchBar = memo(
  ({
    search,
    onSearchChange,
    selectedCount,
    selectedCopyableCount = 0,
    onBulkCopy,
    onBulkDelete,
    bulkDeleting,
    onRefresh,
    ariaLabel = 'Link history actions',
  }) => {
    const linkHistoryT = useTranslations('LinkHistory');
    const inputId = useId();
    return (
      <div className={compactToolbarClass} role="toolbar" aria-label={ariaLabel}>
        <label htmlFor={inputId} className="sr-only">
          {linkHistoryT('searchLabel')}
        </label>
        <input
          id={inputId}
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={compactSearchInputClass}
        />
        {selectedCount > 0 && (
          <>
            <BulkActionButton
              variant="accent"
              onClick={onBulkCopy}
              disabled={selectedCopyableCount === 0}
              icon={<Copy />}
              label={linkHistoryT('actions.copySelected', { count: selectedCount })}
              title={linkHistoryT('actions.copySelectedTitle')}
            />
            <BulkActionButton
              variant="danger"
              onClick={onBulkDelete}
              loading={bulkDeleting}
              icon={<Trash />}
              label={
                bulkDeleting
                  ? linkHistoryT('actions.deletingSelected')
                  : linkHistoryT('actions.deleteSelected', { count: selectedCount })
              }
              title={linkHistoryT('actions.deleteSelectedTitle')}
            />
          </>
        )}
        <BulkActionButton
          variant="primary"
          onClick={onRefresh}
          icon={<Refresh />}
          label="Refresh"
          title="Refresh link history"
        />
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
