'use client';

import SidebarNavItem from './SidebarNavItem';
import { useSidebar } from './SidebarContext';

export default function SidebarNavSection({
  label,
  items,
  isActive,
  getLabel,
  onNavigate,
  className = '',
}) {
  const { collapsed } = useSidebar();

  if (!items.length) return null;

  return (
    <div className={className}>
      {label && !collapsed ? (
        <p className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          {label}
        </p>
      ) : null}
      <ul className={`space-y-0.5 ${collapsed ? 'px-1.5' : 'px-2'}`}>
        {items.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            label={getLabel(item.labelKey)}
            Icon={item.Icon}
            active={isActive(item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </div>
  );
}
