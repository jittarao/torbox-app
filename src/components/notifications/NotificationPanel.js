'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useNotifications } from '@/components/shared/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel({ apiKey, onClose, variant = 'mobile' }) {
  const isDesktop = variant === 'desktop';
  const {
    notifications,
    loading,
    error,
    clearAllNotifications,
    clearNotification,
    markAsRead,
    markAllAsRead,
    retryFetch,
    consecutiveErrors,
  } = useNotifications(apiKey);
  
  const [operationStatus, setOperationStatus] = useState({ type: '', message: '', show: false });
  
  // Memoize handlers to prevent re-renders
  const handleClearAll = useCallback(async () => {
    setOperationStatus({ type: 'loading', message: 'Clearing all...', show: true });
    const result = await clearAllNotifications();
    if (result.success) {
      setOperationStatus({ 
        type: 'success', 
        message: result.message, 
        show: true 
      });
      setTimeout(() => setOperationStatus({ type: '', message: '', show: false }), 3000);
    } else {
      setOperationStatus({ type: 'error', message: result.error, show: true });
      setTimeout(() => setOperationStatus({ type: '', message: '', show: false }), 3000);
    }
  }, [clearAllNotifications]);

  const handleClearNotification = useCallback(async (notificationId) => {
    const result = await clearNotification(notificationId);
    if (!result.success) {
      setOperationStatus({ type: 'error', message: result.error, show: true });
      setTimeout(() => setOperationStatus({ type: '', message: '', show: false }), 3000);
    }
  }, [clearNotification]);

  const handleMarkAsRead = useCallback((notificationId) => {
    markAsRead(notificationId);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);
  
  const panelRef = useRef(null);
  const t = useTranslations('Notifications');

  useEffect(() => {
    if (isDesktop) return;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        const bellButton = event.target.closest('[data-notification-bell]');
        if (!bellButton) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, isDesktop]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <Icons.CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'warning':
        return <Icons.ExclamationTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'error':
        return <Icons.XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'info':
      default:
        return <Icons.AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-l-green-500 dark:border-l-green-400';
      case 'warning':
        return 'border-l-yellow-500 dark:border-l-yellow-400';
      case 'error':
        return 'border-l-red-500 dark:border-l-red-400';
      case 'info':
      default:
        return 'border-l-amber-500 dark:border-l-amber-400';
    }
  };

  const headerActionClass =
    'ui-header-icon-btn !h-8 !w-8 !min-w-8 text-zinc-500 dark:text-zinc-400';

  const panelInner = (
    <div
      ref={panelRef}
      className={`flex flex-col overflow-hidden min-h-0 ${
        isDesktop ? 'h-full flex-1' : 'w-full max-w-sm h-full max-h-[90vh] rounded-xl'
      }`}
    >
        {operationStatus.show && (
          <div className={`px-3 py-2 text-xs font-medium border-b ${
            operationStatus.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
              : operationStatus.type === 'error'
              ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20'
              : 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
          }`}>
            <div className="flex items-center gap-1.5">
              {operationStatus.type === 'loading' && (
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
              )}
              {operationStatus.type === 'success' && <Icons.Check className="h-3 w-3" />}
              {operationStatus.type === 'error' && <Icons.Times className="h-3 w-3" />}
              <span>{operationStatus.message}</span>
            </div>
          </div>
        )}

        <div className="ui-dropdown-header flex items-center justify-between !py-2.5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 min-w-0">
            <Icons.Bell className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="truncate">{t('notifications')}</span>
            {notifications.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-full shrink-0">
                {notifications.length}
              </span>
            )}
          </h3>

          <div className="flex items-center gap-0.5 shrink-0">
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className={headerActionClass}
                  title={t('markAllAsRead')}
                  aria-label={t('markAllAsRead')}
                >
                  <Icons.Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className={`${headerActionClass} hover:!text-red-400`}
                  title={t('clearAll')}
                  aria-label={t('clearAll')}
                >
                  <Icons.Trash className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className={headerActionClass}
              aria-label="Close notifications"
            >
              <Icons.Times className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="ui-dropdown-body flex-1 overflow-y-auto overflow-x-hidden !p-0 min-h-0">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-500/30 border-t-amber-500 mx-auto" />
              <p className="mt-2 text-xs text-zinc-500">{t('loading')}</p>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <Icons.AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-xs text-red-500 font-medium mb-1 px-2">{error}</p>
              {consecutiveErrors >= 3 && (
                <p className="text-xs text-zinc-500 mb-3 px-2">Automatic retries paused</p>
              )}
              <button type="button" onClick={retryFetch} className="ui-btn-primary !text-xs">
                Retry
              </button>
            </div>
          ) : !Array.isArray(notifications) ? (
            <div className="p-4 text-center">
              <p className="text-xs text-red-500 px-2">Invalid notification data</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Icons.Bell className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs text-zinc-500">{t('noNotifications')}</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
              {notifications.map((notification) => {
                if (!notification || typeof notification !== 'object') return null;
                const { id, title, message, type, created_at, read } = notification;
                if (!id || !title || !message) return null;

                return (
                  <div
                    key={id}
                    className={`group relative ${getNotificationColor(type)} ${
                      read ? 'ui-notification-item-read' : 'ui-notification-item-unread'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="shrink-0 mt-0.5">{getNotificationIcon(type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold text-zinc-900 dark:text-zinc-100 break-words ${read ? 'opacity-70' : ''}`}>
                              {title}
                            </p>
                            <p className={`text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed break-words ${read ? 'opacity-60' : ''}`}>
                              {message}
                            </p>
                            <p className="text-[10px] text-zinc-500 mt-1.5">
                              {created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true }) : 'Unknown time'}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {!read && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsRead(id)}
                                className={headerActionClass}
                                title={t('markAsRead')}
                                aria-label={t('markAsRead')}
                              >
                                <Icons.Check className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleClearNotification(id)}
                              className={`${headerActionClass} hover:!text-red-400`}
                              title={t('clear')}
                              aria-label={t('clear')}
                            >
                              <Icons.Times className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        {!read && (
                          <div className="absolute top-2.5 right-2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </div>
  );

  if (isDesktop) {
    return panelInner;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[200]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-sm max-h-[90vh] flex flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl dark:border-zinc-600 dark:bg-[#242428] dark:shadow-[0_24px_56px_-16px_rgba(0,0,0,0.9)]"
          onClick={(e) => e.stopPropagation()}
        >
          {panelInner}
        </div>
      </div>
    </>
  );
}
