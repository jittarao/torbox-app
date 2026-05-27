'use client';

import Link from 'next/link';
import { useSidebar } from './SidebarContext';

export default function SidebarNavItem({ href, label, Icon, active, onNavigate }) {
  const { collapsed } = useSidebar();

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        title={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`${active ? 'ui-sidebar-nav-active' : 'ui-sidebar-nav'} ${
          collapsed ? 'justify-center gap-0 !px-2.5' : ''
        }`}
      >
        <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
        {collapsed ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span className="truncate">{label}</span>
        )}
      </Link>
    </li>
  );
}
