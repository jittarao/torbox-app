'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useNotifications } from '@/components/shared/hooks/useNotifications';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell({ apiKey }) {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, loading, error, setIsPolling, retryFetch, consecutiveErrors } =
    useNotifications(apiKey);
  const t = useTranslations('Notifications');

  useEffect(() => {
    setIsPolling(!isOpen);
  }, [isOpen, setIsPolling]);

  if (!apiKey) {
    return null;
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ui-dropdown-icon-btn relative"
        aria-label={t('notifications')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-notification-bell
        disabled={loading}
      >
        <Icons.Bell className="h-5 w-5" />

        {unreadCount > 0 && !loading && !error && (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0f0f10]"
            aria-hidden
          />
        )}

        {loading && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        )}

        {error && !loading && (
          <span
            className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-600"
            title={`Connection error (${consecutiveErrors} attempts) - Click to retry`}
            onClick={(e) => {
              e.stopPropagation();
              retryFetch();
            }}
            role="presentation"
          >
            <Icons.Times className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </button>

      <HeaderOverlayPortal open={isOpen}>
        <div className="md:hidden">
          <NotificationPanel apiKey={apiKey} onClose={() => setIsOpen(false)} variant="mobile" />
        </div>
      </HeaderOverlayPortal>

      {/* Desktop dropdown */}
      <HeaderDropdownPanel
        open={isOpen}
        widthClass="w-80 max-w-[calc(100vw-2rem)]"
        className="!py-0 hidden md:flex md:flex-col max-h-[min(28rem,calc(100vh-5rem))] overflow-hidden"
      >
        <NotificationPanel apiKey={apiKey} onClose={() => setIsOpen(false)} variant="desktop" />
      </HeaderDropdownPanel>
    </div>
  );
}
