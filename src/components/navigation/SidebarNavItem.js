'use client';

import Link from 'next/link';

export default function SidebarNavItem({ href, label, Icon, active, onNavigate }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={active ? 'ui-sidebar-nav-active' : 'ui-sidebar-nav'}
      >
        <Icon className="w-[18px] h-[18px] shrink-0 opacity-90" aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
