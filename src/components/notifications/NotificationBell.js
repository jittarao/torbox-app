'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useNotifications } from '@/components/shared/hooks/useNotifications';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import NotificationPanel from './NotificationPanel';
import useIsMobile from '@/hooks/useIsMobile';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';

export default function NotificationBell({ apiKey, variant = 'icon' }) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const isMobile = useIsMobile();
  const { unreadCount, loading, error, setIsPolling, retryFetch, consecutiveErrors } =
    useNotifications(apiKey);
  const t = useTranslations('Notifications');

  const closePanel = useCallback(() => setIsOpen(false), []);
  useHeaderDropdownDismiss({ isOpen, onClose: closePanel, anchorRef: rootRef });

  useEffect(() => {
    setIsPolling(!isOpen);
  }, [isOpen, setIsPolling]);

  if (!apiKey) {
    return null;
  }

  const sidebarTrigger = variant === 'sidebar';
  const unreadLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className={`relative shrink-0 ${sidebarTrigger ? 'w-full' : ''}`} ref={rootRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={sidebarTrigger ? 'ui-sidebar-action' : 'ui-dropdown-icon-btn relative'}
        aria-label={t('notifications')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-notification-bell
        disabled={loading}
      >
        {sidebarTrigger ? (
          <>
            <span className="ui-sidebar-action-icon">
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-500" />
              ) : (
                <Icons.Bell className="h-[18px] w-[18px]" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{t('notifications')}</span>
            {unreadCount > 0 && !loading && !error ? (
              <span className="ui-sidebar-count-badge">{unreadLabel}</span>
            ) : error && !loading ? (
              <span className="ui-sidebar-error-dot" aria-hidden />
            ) : (
              <span className="ui-sidebar-disclosure" aria-hidden />
            )}
          </>
        ) : (
          <>
            <Icons.Bell className="h-5 w-5" />

            {unreadCount > 0 && !loading && !error ? (
              <span
                className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-[#0f0f10]"
                aria-hidden
              />
            ) : null}

            {loading ? (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
            ) : null}

            {error && !loading ? (
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
            ) : null}
          </>
        )}
      </button>

      {isMobile ? (
        <HeaderOverlayPortal open={isOpen}>
          <NotificationPanel apiKey={apiKey} onClose={closePanel} variant="mobile" />
        </HeaderOverlayPortal>
      ) : (
        <HeaderDropdownPanel
          open={isOpen}
          placement="sidebar"
          widthClass="w-80 max-w-[calc(100vw-2rem)]"
          className="!py-0 flex flex-col max-h-[min(28rem,calc(100vh-1.5rem))] overflow-hidden"
        >
          <NotificationPanel apiKey={apiKey} onClose={closePanel} variant="desktop" />
        </HeaderDropdownPanel>
      )}
    </div>
  );
}
