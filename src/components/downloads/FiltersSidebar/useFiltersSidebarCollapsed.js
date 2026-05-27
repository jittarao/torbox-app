'use client';

import { useCallback, useState } from 'react';

const STORAGE_KEY = 'torbox-filters-sidebar-collapsed';

function readStoredCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function useFiltersSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { collapsed, toggleCollapsed };
}
