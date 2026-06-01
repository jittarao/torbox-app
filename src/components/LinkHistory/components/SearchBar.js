import { memo } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import BulkActionButton from '@/components/shared/BulkActionButton';
import { compactSearchInputClass, compactToolbarClass } from '@/components/shared/compactToolbar';

const SearchBar = memo(
  ({ search, onSearchChange, selectedCount, onBulkDelete, bulkDeleting, onRefresh }) => {
    return (
      <div className={compactToolbarClass} role="toolbar" aria-label="Link history actions">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={compactSearchInputClass}
        />
        {selectedCount > 0 && (
          <BulkActionButton
            variant="danger"
            onClick={onBulkDelete}
            loading={bulkDeleting}
            icon={<Trash2 />}
            label={bulkDeleting ? 'Deleting' : `Delete (${selectedCount})`}
            title="Delete selected links"
          />
        )}
        <BulkActionButton
          variant="primary"
          onClick={onRefresh}
          icon={<RefreshCw />}
          label="Refresh"
          title="Refresh link history"
        />
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
