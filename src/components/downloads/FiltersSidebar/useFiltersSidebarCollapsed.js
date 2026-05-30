'use client';

import { useCallback, useState } from 'react';
import { getItem, setItem } from '@/utils/storage';

const STORAGE_KEY = 'torbox-filters-sidebar-collapsed';

function readStoredCollapsed() {
  return getItem(STORAGE_KEY) === 'true';
}

export default function useFiltersSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
}
