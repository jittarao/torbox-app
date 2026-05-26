'use client';

import { createContext, useContext } from 'react';

export const SidebarContext = createContext({
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}
