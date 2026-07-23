import { useLayoutEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectStatusCountsFromIds } from '@/store/downloadsDerivedSelectors';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';

function isStatusSelected(status, statusFilter) {
  if (statusFilter === 'all') return false;

  const targetValue = STATUS_OPTIONS.find((opt) => opt.label === status)?.value;
  if (!targetValue) return false;

  const stringifiedTarget = JSON.stringify(targetValue);
  return Array.isArray(statusFilter)
    ? statusFilter.includes(stringifiedTarget)
    : statusFilter === stringifiedTarget;
}

/**
 * Status tab counts from the current view (unfiltered).
 * Subscribes to store entities/order only — derives view ids in useMemo so getSnapshot stays stable.
 */
export function useDownloadsStatusCounts(activeType) {
  const { entities, order } = useTorboxDownloadsStore(
    useShallow((s) => ({ entities: s.entities, order: s.order }))
  );

  const viewIds = useMemo(
    () => selectViewOrderedIds({ entities, order }, activeType),
    [entities, order, activeType]
  );

  const countsCacheRef = useRef({
    ids: [],
    rowRefs: [],
    counts: {},
    total: 0,
  });

  const { counts, total } = useMemo(() => {
    const cache = countsCacheRef.current;

    let refsUnchanged =
      cache.ids.length === viewIds.length && cache.ids.every((id, i) => id === viewIds[i]);

    if (refsUnchanged) {
      for (let i = 0; i < viewIds.length; i++) {
        if (cache.rowRefs[i] !== entities[viewIds[i]]) {
          refsUnchanged = false;
          break;
        }
      }
    }

    if (refsUnchanged) {
      return { counts: cache.counts, total: cache.total };
    }

    return selectStatusCountsFromIds({ entities, order }, activeType);
  }, [entities, order, viewIds, activeType]);

  useLayoutEffect(() => {
    countsCacheRef.current = {
      ids: viewIds.slice(),
      rowRefs: viewIds.map((id) => entities[id]),
      counts,
      total,
    };
  }, [viewIds, entities, counts, total]);

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

  return {
    statusCounts: counts,
    statusOptions,
    isStatusSelected,
  };
}
