'use client';

import { useEffect, useState } from 'react';

/**
 * Returns a trailing-debounced copy of `value`.
 * @param {T} value
 * @param {number} [delayMs=250]
 * @returns {T}
 * @template T
 */
export function useDebouncedValue(value, delayMs = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
