'use client';

import SidebarNavSection from './SidebarNavSection';

export default function SidebarNav({ nav, isActive, getLabel, onNavigate }) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-2">
      <SidebarNavSection
        items={nav.items}
        isActive={isActive}
        getLabel={getLabel}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
