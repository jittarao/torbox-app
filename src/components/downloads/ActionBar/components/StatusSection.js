import { getStatusStyles, getTotalSelectedFiles } from '../utils/statusHelpers';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTranslations } from 'next-intl';

export default function StatusSection({
  statusCounts,
  isStatusSelected,
  unfilteredItems,
  selectedItems,
  hasSelectedFiles,
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
      statusFilter === 'all'
        ? []
        : Array.isArray(statusFilter)
          ? statusFilter
          : [statusFilter];

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
    const itemCount = selectedItems.items?.size;
    const fileCount = getTotalSelectedFiles(selectedItems);
    const downloadSize = getTotalDownloadSize();

    if (itemCount > 0 && fileCount > 0) {
      return t('selectedItemsFiles', {
        itemCount,
        type: itemCount === 1 ? itemTypeName : itemTypePlural,
        fileCount,
        fileType:
          fileCount === 1
            ? commonT('itemTypes.file')
            : commonT('itemTypes.files'),
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
      return t('total', {
        count: unfilteredItems.length,
        type: itemTypePlural,
      });
    }
  };

  return (
    <div className="flex flex-col gap-1 text-md text-primary-text dark:text-primary-text-dark">
      <span
        className={`font-semibold ${statusFilter === 'all' ? 'cursor-default' : 'cursor-pointer hover:text-accent dark:hover:text-accent-dark'}  transition-colors`}
        onClick={() => handleStatusClick('all')}
      >
        {getSelectionText()}
      </span>

      {!(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
        <div className="flex flex-wrap gap-3">
          {Object.entries(statusCounts)
            .reduce((acc, [status, count]) => {
              const option = STATUS_OPTIONS.find((opt) => opt.label === status);
              if (!option || count === 0) return acc;

              // Combine Meta_DL and Checking_Resume_Data into Downloading
              if (status === 'Meta_DL' || status === 'Checking_Resume_Data') {
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
            }, [])
            .map(([status, count]) => {
              const isSelected = Array.isArray(statusFilter)
                ? statusFilter.some((filter) =>
                    isStatusSelected(status, filter),
                  )
                : isStatusSelected(status, statusFilter);

              return (
                <span
                  key={status}
                  onClick={() => handleStatusClick(status)}
                  className={`text-sm font-medium border-b border-dashed cursor-pointer
                    ${getStatusStyles(status)}
                    ${statusFilter !== 'all' && isSelected ? 'opacity-100' : statusFilter !== 'all' ? 'opacity-70' : 'opacity-100'}
                    ${isSelected ? 'border-current' : 'hover:opacity-80 border-current/20 hover:border-current'}
                    transition-all`}
                >
                  {count} {statusT(`${status.toLowerCase()}`)}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
