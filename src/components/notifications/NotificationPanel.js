'use client';

import { useEffect, useRef, useCallback } from 'react';
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
    testNotification,
    markAsRead,
    markAllAsRead,
  } = useNotifications(apiKey);
  
  // Memoize handlers to prevent re-renders
  const handleClearAll = useCallback(async () => {
    const result = await clearAllNotifications();
    if (result.success) {
      // Success feedback could be shown here
    }
  }, [clearAllNotifications]);

  const handleClearNotification = useCallback(async (notificationId) => {
    const result = await clearNotification(notificationId);
    if (result.success) {
      // Success feedback could be shown here
    }
  }, [clearNotification]);

  const handleTestNotification = useCallback(async () => {
    const result = await testNotification();
    if (result.success) {
      // Success feedback could be shown here
    }
  }, [testNotification]);

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
        // Check if the click is not on the notification bell button
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
        return '✅';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'info':
      default:
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
    }
  };

  return (
    <div className="absolute top-full right-0 mt-2 z-50 sm:right-0 right-0">
      {/* Dropdown arrow */}
      <div className="absolute -top-1 right-4 w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
      
      <div
        ref={panelRef}
        className="w-80 max-h-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 sm:w-80 w-72"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('notifications')}
          </h3>
          
          <div className="flex items-center space-x-2">
            {notifications.length > 0 && (
              <>
                <button
                  onClick={handleMarkAllAsRead}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title={t('markAllAsRead')}
                >
                  <Icons.Check className="h-4 w-4" />
                </button>
                <button
                  onClick={handleClearAll}
                  className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  title={t('clearAll')}
                >
                  <Icons.Trash className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Icons.Times className="h-5 w-5" />
            </button>
          </div>
        </div>

                {/* Content */}
        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t('loading')}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('noNotifications')}
              </p>
              <button
                onClick={handleTestNotification}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {t('testNotification')}
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 ${getNotificationColor(notification.type)} ${
                    !notification.read ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-words">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                          title={t('markAsRead')}
                        >
                          <Icons.Check className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={() => handleClearNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title={t('clear')}
                      >
                        <Icons.Times className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
