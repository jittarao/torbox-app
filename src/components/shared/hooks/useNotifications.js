'use client';

import { useState, useEffect, useCallback } from 'react';
import { createApiClient } from '@/utils/apiClient';

export function useNotifications(apiKey) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(true);

  const apiClient = createApiClient(apiKey);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!apiKey) return;

    // Don't show loading state if we already have notifications
    if (notifications.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.getNotifications();
      
      if (response.success && response.data) {
        // Get read notifications from localStorage
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        } catch (error) {
          console.error('Error reading read status from localStorage:', error);
        }
        
        // Apply read status from localStorage
        const notificationsWithReadStatus = response.data.map(notification => ({
          ...notification,
          read: notification.read || readNotifications.includes(notification.id)
        }));
        
        setNotifications(notificationsWithReadStatus);
        const unread = notificationsWithReadStatus.filter(notification => !notification.read).length;
        setUnreadCount(unread);
      } else {
        setError(response.error || 'Failed to fetch notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // Only set error if it's not a network error (CORS, etc.)
      if (error.message !== 'NetworkError when attempting to fetch resource.') {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiClient, notifications.length]);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await apiClient.clearAllNotifications();
      
      if (response.success) {
        setNotifications([]);
        setUnreadCount(0);
        // Clear read status from localStorage
        try {
          localStorage.removeItem('readNotifications');
        } catch (error) {
          console.error('Error clearing read status from localStorage:', error);
        }
        return { success: true };
      } else {
        throw new Error(response.error || 'Failed to clear notifications');
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return { success: false, error: error.message };
    }
  }, [apiKey, apiClient]);

  // Clear specific notification
  const clearNotification = useCallback(async (notificationId) => {
    if (!apiKey) return;

    try {
      const response = await apiClient.clearNotification(notificationId);
      
      if (response.success) {
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Remove from read status in localStorage
        try {
          const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
          const updatedReadNotifications = readNotifications.filter(id => id !== notificationId);
          localStorage.setItem('readNotifications', JSON.stringify(updatedReadNotifications));
        } catch (error) {
          console.error('Error updating read status in localStorage:', error);
        }
        
        return { success: true };
      } else {
        throw new Error(response.error || 'Failed to clear notification');
      }
    } catch (error) {
      console.error('Error clearing notification:', error);
      return { success: false, error: error.message };
    }
  }, [apiKey, apiClient]);

  // Test notifications
  const testNotification = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await apiClient.testNotification();
      
      if (response.success) {
        return { success: true, message: 'Test notification sent successfully' };
      } else {
        throw new Error(response.error || 'Failed to send test notification');
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      return { success: false, error: error.message };
    }
  }, [apiKey, apiClient]);

  // Mark notification as read
  const markAsRead = useCallback((notificationId) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true }
          : notification
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    
    // Store read status in localStorage
    try {
      const readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
      if (!readNotifications.includes(notificationId)) {
        readNotifications.push(notificationId);
        localStorage.setItem('readNotifications', JSON.stringify(readNotifications));
      }
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    setUnreadCount(0);
    
    // Store all notification IDs as read in localStorage
    try {
      const allNotificationIds = notifications.map(n => n.id);
      localStorage.setItem('readNotifications', JSON.stringify(allNotificationIds));
    } catch (error) {
      console.error('Error saving read status to localStorage:', error);
    }
  }, [notifications]);

  // Add new notification (for real-time updates)
  const addNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    if (!notification.read) {
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  // Remove notification
  const removeNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // Initial fetch - only run once
  useEffect(() => {
    if (apiKey && notifications.length === 0) {
      fetchNotifications();
    }
  }, [apiKey]); // Remove fetchNotifications from dependencies to prevent re-runs

  // Auto-refresh notifications every 2 minutes
  useEffect(() => {
    if (!apiKey || !isPolling) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [apiKey, isPolling]); // Remove fetchNotifications from dependencies

  return {
    notifications,
    loading,
    error,
    unreadCount,
    fetchNotifications,
    clearAllNotifications,
    clearNotification,
    testNotification,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    setIsPolling,
  };
}
