'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import useAdminStore from '@/store/adminStore';
import { Moon, Sun } from '@/components/icons';
import { ADMIN_NAV_ITEMS } from './adminNavConfig';

export default function AdminMobileNav({ locale = 'en' }) {
  const pathname = usePathname();
  const { push } = useRouter();
  const logout = useAdminStore((s) => s.logout);
  const { darkMode, toggleDarkMode } = useTheme();

  const isActive = (path) => {
    const fullPath = `/${locale}${path}`;
    if (path === '/admin/dashboard') return pathname === fullPath;
    return pathname?.startsWith(fullPath);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/95 backdrop-blur-md dark:border-border-dark/60 dark:bg-surface-dark/95 md:hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="shrink-0 text-sm font-semibold text-primary-text dark:text-primary-text-dark">
          Admin
        </span>
        <nav
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Admin pages"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={`/${locale}${item.path}`}
                className={
                  active
                    ? 'shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted dark:text-muted-dark'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleDarkMode}
            className="ui-header-icon-btn"
            aria-label={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              push(`/${locale}/admin`);
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:text-label-danger-text dark:text-muted-dark"
          >
            Out
          </button>
        </div>
      </div>
    </header>
  );
}
