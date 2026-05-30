'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { getItem, setItem } from '@/utils/storage';

const STORAGE_KEY = 'torbox-sidebar-collapsed';

export default function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => getItem(STORAGE_KEY) === 'true');
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed: hydrated ? collapsed : false, toggleCollapsed, hydrated };
}
