'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Apply single-row or shift+click range selection to a Set of row ids.
 * @returns {{ next: Set, lastIndex: number|null }}
 */
export function applyShiftRangeToSet(
  prev,
  id,
  checked,
  rowIndex,
  isShiftKey,
  lastIndex,
  items,
  getRowId
) {
  if (
    isShiftKey &&
    typeof rowIndex === 'number' &&
    typeof lastIndex === 'number' &&
    lastIndex !== null
  ) {
    const start = Math.min(lastIndex, rowIndex);
    const end = Math.max(lastIndex, rowIndex);
    const next = new Set(prev);
    for (let i = start; i <= end; i++) {
      const item = items[i];
      if (!item) continue;
      const itemId = getRowId(item);
      if (itemId == null) continue;
      if (checked) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
    }
    return { next, lastIndex: rowIndex };
  }

  const next = new Set(prev);
  if (checked) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return {
    next,
    lastIndex: typeof rowIndex === 'number' ? rowIndex : lastIndex,
  };
}

/**
 * Shift+click range selection for table row checkboxes (visible list order).
 */
export function useShiftRangeRowSelection(items, getRowId) {
  const lastClickedIndexRef = useRef(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const resetAnchor = useCallback(() => {
    lastClickedIndexRef.current = null;
  }, []);

  const buildSelectionUpdater = useCallback(
    (id, checked, rowIndex, isShiftKey = false) => {
      return (prev) => {
        const { next, lastIndex } = applyShiftRangeToSet(
          prev,
          id,
          checked,
          rowIndex,
          isShiftKey,
          lastClickedIndexRef.current,
          itemsRef.current,
          getRowId
        );
        lastClickedIndexRef.current = lastIndex;
        return next;
      };
    },
    [getRowId]
  );

  return { buildSelectionUpdater, resetAnchor };
}
