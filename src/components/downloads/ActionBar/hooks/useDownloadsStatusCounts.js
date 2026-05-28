import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectStatusCountsFromIds } from '@/store/downloadsDerivedSelectors';

/**
 * Status tab counts from the current view (unfiltered), derived from entity store.
 */
export function useDownloadsStatusCounts(activeType) {
  const torboxSlice = useTorboxDownloadsStore(
    useShallow((s) => ({
      entities: s.entities,
      order: s.order,
    }))
  );

  const { counts, total } = useMemo(
    () => selectStatusCountsFromIds(torboxSlice, activeType),
    [torboxSlice, activeType]
  );

  const statusOptions = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, option) => {
      if (option.hidden) return acc;
      if (option.label === 'All') {
        acc.push({ ...option, label: `All (${total})` });
      } else {
        acc.push({ ...option, label: `${option.label} (${counts[option.label] || 0})` });
      }
      return acc;
    }, []);
  }, [counts, total]);

  const isStatusSelected = (status, statusFilter) => {
    if (statusFilter === 'all') return false;

    const targetValue = STATUS_OPTIONS.find((opt) => opt.label === status)?.value;
    if (!targetValue) return false;

    const stringifiedTarget = JSON.stringify(targetValue);
    return Array.isArray(statusFilter)
      ? statusFilter.includes(stringifiedTarget)
      : statusFilter === stringifiedTarget;
  };

  return {
    statusCounts: counts,
    statusOptions,
    isStatusSelected,
  };
}
