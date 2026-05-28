'use client';

import { createContext, use } from 'react';

export const SidebarContext = createContext({
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useSidebar() {
  return use(SidebarContext);
}
