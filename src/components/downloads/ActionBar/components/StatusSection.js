import { getStatusStyles } from '../utils/statusHelpers';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTranslations } from 'next-intl';

export default function StatusSection({
  statusCounts,
  isStatusSelected,
  unfilteredItems,
  filteredItems,
  selectedItemCount = 0,
  selectedFileCount = 0,
  hasSelectedFiles = false,
  statusFilter,
  onStatusChange,
  itemTypeName,
  itemTypePlural,
  getTotalDownloadSize,
}) {
  const t = useTranslations('StatusSection');
  const commonT = useTranslations('Common');
  const statusT = useTranslations('Statuses');

  const handleStatusClick = (status) => {
    if (status === 'all') {
      onStatusChange('all');
      return;
    }

    const option = STATUS_OPTIONS.find((opt) => opt.label === status);
    if (!option) return;

    const newValue = JSON.stringify(option.value);

    // If already all, clear it first
    const currentFilters =
      statusFilter === 'all' ? [] : Array.isArray(statusFilter) ? statusFilter : [statusFilter];

    const filterIndex = currentFilters.indexOf(newValue);

    if (filterIndex === -1) {
      // Add the filter
      onStatusChange([...currentFilters, newValue]);
    } else {
      // Remove the filter
      const newFilters = [...currentFilters];
      newFilters.splice(filterIndex, 1);
      // Switch to 'all' if removing the last filter
      onStatusChange(currentFilters.length === 1 ? 'all' : newFilters);
    }
  };

  const getSelectionText = () => {
    const itemCount = selectedItemCount;
    const fileCount = selectedFileCount;
    const downloadSize = getTotalDownloadSize();

    if (itemCount > 0 && fileCount > 0) {
      return t('selectedItemsFiles', {
        itemCount,
        type: itemCount === 1 ? itemTypeName : itemTypePlural,
        fileCount,
        fileType: fileCount === 1 ? commonT('itemTypes.file') : commonT('itemTypes.files'),
        size: downloadSize,
      });
    } else if (itemCount > 0) {
      return t('selectedItems', {
        itemCount,
        type: itemCount === 1 ? itemTypeName : itemTypePlural,
        size: downloadSize,
      });
    } else if (fileCount > 0) {
      return t('selectedFiles', {
        fileCount,
        type: commonT('itemTypes.file'),
        size: downloadSize,
      });
    } else {
      // Show filtered count if filters are applied, otherwise show total
      const displayItems = filteredItems || unfilteredItems;
      const totalCount = unfilteredItems.length;
      const filteredCount = filteredItems?.length;

      // If filters are applied and count differs, show "X of Y" format
      if (filteredItems && filteredCount !== totalCount && filteredCount !== undefined) {
        const baseText = t('total', {
          count: filteredCount,
          type: itemTypePlural,
        });
        return `${baseText} (of ${totalCount})`;
      }

      return t('total', {
        count: displayItems.length,
        type: itemTypePlural,
      });
    }
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-primary-text dark:text-primary-text-dark">
      <button
        type="button"
        disabled={statusFilter === 'all'}
        className={`min-w-0 font-semibold xl:shrink-0 xl:whitespace-nowrap ${statusFilter === 'all' ? 'cursor-default' : 'cursor-pointer hover:text-accent dark:hover:text-accent-dark'} transition-colors`}
        onClick={() => handleStatusClick('all')}
        onKeyDown={(e) => {
          if (statusFilter !== 'all' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleStatusClick('all');
          }
        }}
      >
        {getSelectionText()}
      </button>

      {!(selectedItemCount > 0 || hasSelectedFiles) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {STATUS_OPTIONS.reduce((acc, option) => {
            const { label: status } = option;
            const count = statusCounts[status] || 0;
            if (count === 0) return acc;

            const isDownloadingGroup =
              status === 'Downloading' || status === 'Meta_DL' || status === 'Checking_Resume_Data';

            if (isDownloadingGroup) {
              const existing = acc.find(([s]) => s === 'Downloading');
              if (existing) {
                existing[1] += count;
              } else {
                acc.push(['Downloading', count]);
              }
            } else if (!option.hidden) {
              acc.push([status, count]);
            }
            return acc;
          }, []).map(([status, count]) => {
            const isSelected = Array.isArray(statusFilter)
              ? statusFilter.some((filter) => isStatusSelected(status, filter))
              : isStatusSelected(status, statusFilter);

            return (
              <button
                type="button"
                key={status}
                onClick={() => handleStatusClick(status)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleStatusClick(status);
                  }
                }}
                className={`text-xs font-medium border-b border-dashed cursor-pointer sm:text-sm
                    ${getStatusStyles(status)}
                    ${statusFilter !== 'all' && isSelected ? 'opacity-100' : statusFilter !== 'all' ? 'opacity-70' : 'opacity-100'}
                    ${isSelected ? 'border-current' : 'hover:opacity-80 border-current/20 hover:border-current'}
                    transition-all`}
              >
                {count} {statusT(`${status.toLowerCase()}`)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
