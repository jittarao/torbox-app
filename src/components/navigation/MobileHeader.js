'use client';

import Link from 'next/link';
import NotificationBell from '@/components/notifications/NotificationBell';
import { USER_NAV_ITEM } from './navConfig';

export default function MobileHeader({ title, apiKey, isUserActive, userLabel }) {
  const UserIcon = USER_NAV_ITEM.Icon;

  return (
    <header className="z-mobile-header sticky top-0 flex items-center justify-between gap-2 border-b border-border/60 bg-surface/90 px-3 py-2 backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/90 md:hidden">
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-primary-text dark:text-primary-text-dark">
        {title}
      </h1>
      <div className="flex shrink-0 items-center gap-0.5">
        {apiKey ? <NotificationBell apiKey={apiKey} /> : null}
        <Link
          href={USER_NAV_ITEM.href}
          aria-label={userLabel}
          aria-current={isUserActive ? 'page' : undefined}
          title={userLabel}
          className={`ui-header-icon-btn ${
            isUserActive ? 'text-amber-700 dark:text-amber-400 bg-amber-500/15' : ''
          }`}
        >
          <UserIcon className="size-5 shrink-0" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
