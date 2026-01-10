'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useNotifications } from '@/components/shared/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationPanel({ apiKey, onClose }) {
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

  // Close panel when clicking outside
  useEffect(() => {
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
  }, [onClose]);

  // Close panel on escape key
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
        return <Icons.AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
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
        return 'border-l-blue-500 dark:border-l-blue-400';
    }
  };

  return (
    <>
      {/* Mobile: Full screen overlay */}
      <div className="md:hidden fixed inset-0 bg-black/50 z-[100]" onClick={onClose}></div>
      
      {/* Panel container */}
      <div className="fixed md:absolute inset-0 md:inset-auto md:top-full md:right-0 md:mt-2 z-[101] md:z-50 flex items-center justify-center md:block md:items-start md:justify-start p-4 md:p-0">
        {/* Dropdown arrow - hidden on mobile */}
        <div className="hidden md:block absolute -top-1 right-4 w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45 z-10"></div>
        
        <div
          ref={panelRef}
          className="w-full max-w-sm md:w-80 h-full max-h-[90vh] md:h-auto md:max-h-[28rem] bg-white dark:bg-gray-800 rounded-xl md:rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm overflow-hidden flex flex-col relative"
        >
        {/* Status Message */}
        {operationStatus.show && (
          <div className={`px-3 py-2 text-xs font-medium transition-all duration-200 ${
            operationStatus.type === 'success' 
              ? 'bg-green-50/90 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-b border-green-200/50 dark:border-green-800/50'
              : operationStatus.type === 'error'
              ? 'bg-red-50/90 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-b border-red-200/50 dark:border-red-800/50'
              : 'bg-blue-50/90 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-b border-blue-200/50 dark:border-blue-800/50'
          }`}>
            <div className="flex items-center gap-1.5">
              {operationStatus.type === 'loading' && (
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent"></div>
              )}
              {operationStatus.type === 'success' && (
                <Icons.Check className="h-3 w-3" />
              )}
              {operationStatus.type === 'error' && (
                <Icons.Times className="h-3 w-3" />
              )}
              <span>{operationStatus.message}</span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/30">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Icons.Bell className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{t('notifications')}</span>
            {notifications.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full flex-shrink-0">
                {notifications.length}
              </span>
            )}
          </h3>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-2 md:p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 active:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 dark:active:bg-gray-700 transition-colors touch-manipulation"
                  title={t('markAllAsRead')}
                  aria-label={t('markAllAsRead')}
                >
                  <Icons.Check className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </button>
                <button
                  onClick={handleClearAll}
                  className="p-2 md:p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 dark:active:bg-red-900/30 transition-colors touch-manipulation"
                  title={t('clearAll')}
                  aria-label={t('clearAll')}
                >
                  <Icons.Trash className="h-4 w-4 md:h-3.5 md:w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 md:p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 active:bg-gray-200 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50 dark:active:bg-gray-700 transition-colors touch-manipulation"
              aria-label="Close notifications"
            >
              <Icons.Times className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          {loading ? (
            <div className="p-4 md:p-6 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mx-auto"></div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('loading')}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <Icons.AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400 mx-auto mb-2" />
              <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1 px-2">
                {error}
              </p>
              {consecutiveErrors >= 3 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 px-2">
                  Automatic retries paused
                </p>
              )}
              <button
                onClick={retryFetch}
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700 transition-colors touch-manipulation"
              >
                Retry
              </button>
            </div>
          ) : !Array.isArray(notifications) ? (
            <div className="p-4 text-center">
              <p className="text-xs text-red-600 dark:text-red-400 px-2">
                Invalid notification data
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 md:p-6 text-center">
              <Icons.Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('noNotifications')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {notifications.map((notification) => {
                if (!notification || typeof notification !== 'object') {
                  return null;
                }
                
                const { id, title, message, type, created_at, read } = notification;
                
                if (!id || !title || !message) {
                  return null;
                }
                
                return (
                  <div
                    key={id}
                    className={`group relative px-2.5 md:px-3 py-2 md:py-2.5 border-l-2 ${getNotificationColor(type)} transition-colors ${
                      !read 
                        ? 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700' 
                        : 'bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 active:bg-gray-200/50 dark:active:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start gap-2 md:gap-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold text-gray-900 dark:text-white break-words ${
                              !read ? '' : 'opacity-70'
                            }`}>
                              {title}
                            </p>
                            <p className={`text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed break-words ${
                              !read ? '' : 'opacity-60'
                            }`}>
                              {message}
                            </p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
                              {created_at ? formatDistanceToNow(new Date(created_at), { addSuffix: true }) : 'Unknown time'}
                            </p>
                          </div>
                          
                          {/* Action buttons - always visible on mobile, hover-reveal on desktop */}
                          <div className="flex items-center gap-0.5 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity">
                            {!read && (
                              <button
                                onClick={() => handleMarkAsRead(id)}
                                className="p-1.5 md:p-1 rounded-md text-gray-400 hover:text-green-600 hover:bg-green-50 active:bg-green-100 dark:hover:text-green-400 dark:hover:bg-green-900/20 dark:active:bg-green-900/30 transition-colors touch-manipulation"
                                title={t('markAsRead')}
                                aria-label={t('markAsRead')}
                              >
                                <Icons.Check className="h-3.5 w-3.5 md:h-3 md:w-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleClearNotification(id)}
                              className="p-1.5 md:p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-900/20 dark:active:bg-red-900/30 transition-colors touch-manipulation"
                              title={t('clear')}
                              aria-label={t('clear')}
                            >
                              <Icons.Times className="h-3.5 w-3.5 md:h-3 md:w-3" />
                            </button>
                          </div>
                        </div>
                        {!read && (
                          <div className="absolute top-2 right-12 md:right-2 w-1.5 h-1.5 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
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
      </div>
    </>
  );
}
