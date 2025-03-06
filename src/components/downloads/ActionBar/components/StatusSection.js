import { getStatusStyles, getTotalSelectedFiles } from '../utils/statusHelpers';
import { STATUS_OPTIONS } from '@/components/constants';

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
  const torrentText =
    selectedItems.items?.size > 0
      ? `${selectedItems.items?.size} ${selectedItems.items?.size === 1 ? itemTypeName : itemTypePlural}`
      : '';

  const fileCount = getTotalSelectedFiles(selectedItems);
  const fileText =
    fileCount > 0 ? `${fileCount} ${fileCount === 1 ? 'file' : 'files'}` : '';

  const parts = [torrentText, fileText].filter(Boolean);
  const downloadSize = getTotalDownloadSize();

  return (
    <div className="text-md text-primary-text dark:text-primary-text-dark">
      <span
        className={`font-semibold ${statusFilter === 'all' ? 'cursor-default' : 'cursor-pointer hover:text-accent dark:hover:text-accent-dark'}  transition-colors`}
        onClick={() => handleStatusClick('all')}
      >
        {selectedItems.items?.size > 0 || hasSelectedFiles()
          ? `${parts.join(' & ')} selected (${downloadSize})`
          : `${unfilteredItems.length} ${itemTypePlural}`}
      </span>

      {!(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
        <div className="flex flex-wrap gap-3 mt-1.5">
          {Object.entries(statusCounts)
            .filter(([status, count]) => count !== 0)
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
                  {count} {status.toLowerCase()}
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}
