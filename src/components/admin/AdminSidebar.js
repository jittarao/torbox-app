'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { getVersion } from '@/utils/version';
import useAdminStore from '@/store/adminStore';
import { ExternalLink, Moon, Sun } from '@/components/icons';
import { ADMIN_NAV_ITEMS } from './adminNavConfig';

function AdminSidebarBrand({ collapsed }) {
  return (
    <Link
      href="/"
      title={collapsed ? 'TorBox Manager' : undefined}
      className={`flex min-w-0 items-center rounded-lg py-1 transition-colors hover:bg-surface-alt-hover dark:hover:bg-surface-alt-dark-hover ${
        collapsed ? 'justify-center' : 'gap-2.5'
      }`}
    >
      <Image src="/images/TBM-logo.png" alt="TorBox Manager" width={28} height={28} className="shrink-0" />
      {!collapsed ? (
        <div className="min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-primary-text dark:text-primary-text-dark">
            TorBox Manager
          </span>
          <span className="truncate text-[11px] text-muted dark:text-muted-dark">
            Admin · v{getVersion()}
          </span>
        </div>
      ) : null}
    </Link>
  );
}

export default function AdminSidebar({ locale = 'en' }) {
  const pathname = usePathname();
  const { push } = useRouter();
  const logout = useAdminStore((s) => s.logout);
  const { darkMode, toggleDarkMode } = useTheme();

  const isActive = (path) => {
    const fullPath = `/${locale}${path}`;
    if (path === '/admin/dashboard') {
      return pathname === fullPath;
    }
    return pathname?.startsWith(fullPath);
  };

  const handleLogout = () => {
    logout();
    push(`/${locale}/admin`);
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[var(--admin-sidebar-width)] flex-col border-r border-border/60 bg-surface/90 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 md:flex"
      aria-label="Admin navigation"
    >
      <div className="shrink-0 border-b border-border/40 px-3 py-3 dark:border-border-dark/40">
        <AdminSidebarBrand collapsed={false} />
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        <p className="ui-sidebar-section-label">Operations</p>
        <ul className="space-y-0.5">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.Icon;
            return (
              <li key={item.path}>
                <Link
                  href={`/${locale}${item.path}`}
                  aria-current={active ? 'page' : undefined}
                  className={active ? 'ui-sidebar-nav-active' : 'ui-sidebar-nav'}
                >
                  <Icon className="size-[18px] shrink-0 opacity-90" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="ui-sidebar-dock ui-sidebar-dock-secondary mt-auto shrink-0">
        <a
          href={`/${locale}/`}
          className="ui-sidebar-action"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="ui-sidebar-action-icon">
            <ExternalLink className="size-4" aria-hidden />
          </span>
          <span className="truncate">Open user portal</span>
        </a>

        <div className="ui-sidebar-controls">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="ui-sidebar-control-btn flex-1"
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        <button type="button" onClick={handleLogout} className="ui-btn-ghost w-full justify-center">
          Sign out
        </button>
      </div>
    </aside>
  );
}
