'use client';

import { Fragment } from 'react';
import SidebarNavSection from './SidebarNavSection';
import { useSidebar } from './SidebarContext';

export default function SidebarNav({ nav, isActive, getLabel, onNavigate }) {
  const { collapsed } = useSidebar();

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-2">
      {nav.sections.map((section, index) => (
        <Fragment key={section.id}>
          {index > 0 ? (
            <div
              role="separator"
              aria-hidden
              className={`my-2 h-px shrink-0 bg-zinc-200 dark:bg-zinc-700 ${
                collapsed ? 'mx-auto w-8' : 'mx-4'
              }`}
            />
          ) : null}
          <SidebarNavSection
            label={section.labelKey ? getLabel(section.labelKey) : undefined}
            items={section.items}
            isActive={isActive}
            getLabel={getLabel}
            onNavigate={onNavigate}
          />
        </Fragment>
      ))}
    </nav>
  );
}
