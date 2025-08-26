'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { useNotifications } from '@/components/shared/hooks/useNotifications';
import NotificationPanel from './NotificationPanel';

export default function NotificationBell({ apiKey }) {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, loading, error, setIsPolling } = useNotifications(apiKey);
  const t = useTranslations('Notifications');

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Pause polling when dropdown is open
  useEffect(() => {
    setIsPolling(!isOpen);
  }, [isOpen, setIsPolling]);

  // Don't render if no API key
  if (!apiKey) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors duration-200"
        aria-label={t('notifications')}
        data-notification-bell
        disabled={loading}
      >
        <Icons.Bell className={`h-6 w-6 ${unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : ''}`} />
        
        {/* Notification badge - Hidden */}
        {/* {unreadCount > 0 && !loading && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )} */}
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute -top-1 -right-1 h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}

        {/* Error indicator */}
        {error && !loading && (
          <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
            <Icons.Times className="h-3 w-3 text-white" />
          </div>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <NotificationPanel 
          apiKey={apiKey} 
          onClose={handleClose}
        />
      )}
    </div>
  );
}
