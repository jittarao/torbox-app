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
          collapsed ? 'justify-center !px-2.5' : ''
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
        <span
          className={`truncate transition-[opacity,width,margin] duration-300 ease-out ${
            collapsed ? 'pointer-events-none m-0 w-0 opacity-0' : 'opacity-100'
          }`}
        >
          {label}
        </span>
      </Link>
    </li>
  );
}
