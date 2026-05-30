import { useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { STATUS_OPTIONS } from '@/components/constants';
import { useTorboxDownloadsStore } from '@/store/torboxDownloadsStore';
import { selectStatusCountsFromIds } from '@/store/downloadsDerivedSelectors';
import { selectViewOrderedIds } from '@/store/torboxDownloadsSelectors';

/**
 * Status tab counts from the current view (unfiltered).
 * Subscribes only to entities in the active view — avoids rerenders when other tabs' rows update.
 */
export function useDownloadsStatusCounts(activeType) {
  const viewSlice = useTorboxDownloadsStore(
    useShallow((s) => {
      const ids = selectViewOrderedIds(s, activeType);
      const rows = {};
      for (let i = 0; i < ids.length; i++) {
        const key = ids[i];
        rows[key] = s.entities[key];
      }
      return { order: s.order, ids, rows };
    })
  );

  const countsCacheRef = useRef({
    ids: [],
    rowRefs: [],
    counts: {},
    total: 0,
  });

  const { counts, total } = useMemo(() => {
    const { ids, rows, order } = viewSlice;
    const cache = countsCacheRef.current;

    let refsUnchanged =
      cache.ids.length === ids.length && cache.ids.every((id, i) => id === ids[i]);

    if (refsUnchanged) {
      for (let i = 0; i < ids.length; i++) {
        if (cache.rowRefs[i] !== rows[ids[i]]) {
          refsUnchanged = false;
          break;
        }
      }
    }

    if (refsUnchanged) {
      return { counts: cache.counts, total: cache.total };
    }

    const result = selectStatusCountsFromIds({ entities: rows, order }, activeType);

    countsCacheRef.current = {
      ids: ids.slice(),
      rowRefs: ids.map((id) => rows[id]),
      counts: result.counts,
      total: result.total,
    };

    return result;
  }, [viewSlice, activeType]);

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
