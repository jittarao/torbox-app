'use client';

import { useEffect, useRef } from 'react';

/**
 * Merge or remove a range of filter IDs for shift+click bulk select.
 * @param {unknown[]} currentIds
 * @param {unknown[]} rangeIds
 * @param {boolean} activate
 * @param {(id: unknown) => unknown} [normalizeId]
 */
export function computeRangeSelection(currentIds, rangeIds, activate, normalizeId = (id) => id) {
  const normalize = (id) => normalizeId(id);
  const key = (id) => String(normalize(id));

  if (activate) {
    const seen = new Set((currentIds || []).map(key));
    const result = [...(currentIds || [])];
    for (const id of rangeIds) {
      const normalized = normalize(id);
      const k = key(normalized);
      if (!seen.has(k)) {
        result.push(normalized);
        seen.add(k);
      }
    }
    return result;
  }

  const remove = new Set(rangeIds.map(key));
  return (currentIds || []).filter((id) => !remove.has(key(id)));
}

/**
 * Tracks last clicked index for shift+click range selection in a sidebar section.
 * Resets anchor when resetKey changes (e.g. search query).
 * @param {unknown} resetKey
 */
export function useSidebarShiftSelect(resetKey) {
  const lastIndexRef = useRef(null);

  useEffect(() => {
    lastIndexRef.current = null;
  }, [resetKey]);

  return { lastIndexRef };
}
