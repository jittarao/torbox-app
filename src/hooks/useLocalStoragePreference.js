'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { getItem, setItem } from '@/utils/storage';
import { useLatestRef } from '@/hooks/useLatestRef';

/**
 * Hydration-safe localStorage preference with server default until client mounts.
 */
export function useLocalStoragePreference(
  storageKey,
  serverDefault,
  { parse = (v) => v, serialize = (v) => String(v), validate } = {}
) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return serverDefault;
    const raw = getItem(storageKey);
    if (raw == null) return serverDefault;
    try {
      const parsed = parse(raw);
      if (validate && !validate(parsed)) return serverDefault;
      return parsed;
    } catch {
      return serverDefault;
    }
  });

  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const serializeRef = useLatestRef(serialize);

  const setPreference = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        setItem(storageKey, serializeRef.current(resolved));
        return resolved;
      });
    },
    [storageKey, serializeRef]
  );

  return {
    value: hydrated ? value : serverDefault,
    setValue: setPreference,
    hydrated,
  };
}
