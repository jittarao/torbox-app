'use client';

import SidebarNavSection from './SidebarNavSection';
import SidebarNavItem from './SidebarNavItem';
import { USER_NAV_ITEM } from './navConfig';
import { useSidebar } from './SidebarContext';

export default function SidebarNav({ nav, isActive, getLabel, onNavigate }) {
  const { collapsed } = useSidebar();
  const userLabel = getLabel(USER_NAV_ITEM.labelKey);
  const userActive = isActive(USER_NAV_ITEM.href);

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-2">
      <SidebarNavSection
        items={nav.items}
        isActive={isActive}
        getLabel={getLabel}
        onNavigate={onNavigate}
      />
      <hr
        className={
          collapsed
            ? 'mx-auto my-2 h-px w-8 bg-border/60 dark:bg-border-dark/60'
            : 'mx-4 my-2 border-t border-border/40 dark:border-border-dark/40'
        }
      />
      <ul className={`space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        <SidebarNavItem
          href={USER_NAV_ITEM.href}
          label={userLabel}
          Icon={USER_NAV_ITEM.Icon}
          active={userActive}
          onNavigate={onNavigate}
        />
      </ul>
    </nav>
  );
}
