'use client';

import SidebarNavItem from './SidebarNavItem';

export default function SidebarNavSection({
  label,
  items,
  isActive,
  getLabel,
  onNavigate,
  className = '',
}) {
  if (!items.length) return null;

  return (
    <div className={className}>
      {label ? (
        <p className="px-3 pt-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          {label}
        </p>
      ) : null}
      <ul className="space-y-0.5 px-2">
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
