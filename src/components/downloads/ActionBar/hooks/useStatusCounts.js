import { useMemo } from 'react';
import { STATUS_OPTIONS } from '@/components/constants';
import { getMatchingStatus } from '../utils/statusHelpers';

export const useStatusCounts = (unfilteredItems) => {
  // Get the status for each item
  const itemStatuses = useMemo(() => {
    return unfilteredItems.map((item) => {
      const status = getMatchingStatus(item);
      return {
        [item.id]: status,
      };
    });
  }, [unfilteredItems]);

  // Get the count of each status
  const statusCounts = useMemo(() => {
    let localStatusCounts = itemStatuses.reduce((acc, curr) => {
      const status = curr[Object.keys(curr)[0]];
      if (status) {
        acc[status.label] = (acc[status.label] || 0) + 1;
      }
      return acc;
    }, {});

    const orderedStatusCounts = {};
    STATUS_OPTIONS.forEach((option) => {
      orderedStatusCounts[option.label] = localStatusCounts[option.label] || 0;
    });

    return orderedStatusCounts;
  }, [itemStatuses]);

  // Update the label key in STATUS_OPTIONS to include counts
  const statusOptions = useMemo(() => {
    return STATUS_OPTIONS.filter((option) => !option.hidden).map((option) => {
      if (option.label === 'All') {
        return {
          ...option,
          label: `All (${unfilteredItems.length})`,
        };
      }
      return {
        ...option,
        label: `${option.label} (${statusCounts[option.label] || 0})`,
      };
    });
  }, [statusCounts, unfilteredItems.length]);

  const isStatusSelected = (status, statusFilter) => {
    if (statusFilter === 'all') return false;

    const targetValue = STATUS_OPTIONS.find(
      (opt) => opt.label === status,
    )?.value;
    if (!targetValue) return false;

    const stringifiedTarget = JSON.stringify(targetValue);
    return Array.isArray(statusFilter)
      ? statusFilter.includes(stringifiedTarget)
      : statusFilter === stringifiedTarget;
  };

  return {
    statusCounts,
    statusOptions,
    isStatusSelected,
  };
};
