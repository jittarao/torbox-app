import { getStatusStyles } from '../utils/statusHelpers';
import { STATUS_OPTIONS } from '@/components/constants';

export default function StatusSection({
  statusCounts,
  isStatusSelected,
  unfilteredItems,
  selectedItems,
  hasSelectedFiles,
  statusFilter,
  onStatusChange,
  itemTypePlural,
}) {
  return (
    <div className="text-md text-primary-text dark:text-primary-text-dark">
      <span
        className={`font-semibold ${statusFilter === 'all' ? 'cursor-default' : 'cursor-pointer hover:text-accent dark:hover:text-accent-dark'}  transition-colors`}
        onClick={() => onStatusChange('all')}
      >
        {unfilteredItems.length} {itemTypePlural}
      </span>

      {!(selectedItems.items?.size > 0 || hasSelectedFiles()) && (
        <div className="flex flex-wrap gap-3 mt-1.5">
          {Object.entries(statusCounts)
            .filter(([status, count]) => count !== 0)
            .map(([status, count]) => {
              const isSelected = isStatusSelected(status, statusFilter);
              return (
                <span
                  key={status}
                  onClick={() => {
                    const option = STATUS_OPTIONS.find(
                      (opt) => opt.label === status,
                    );
                    if (option) {
                      const newValue =
                        typeof option.value === 'object'
                          ? JSON.stringify(option.value)
                          : option.value;
                      onStatusChange(newValue);
                    }
                  }}
                  className={`text-sm font-medium border-b border-dashed 
                    ${getStatusStyles(status)}
                    ${statusFilter !== 'all' && isSelected ? 'opacity-100' : statusFilter !== 'all' ? 'opacity-60' : 'opacity-100'}
                    ${isSelected ? 'border-current cursor-default' : 'cursor-pointer hover:opacity-80 border-current/30 hover:border-current'}
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
