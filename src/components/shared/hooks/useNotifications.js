'use client';

import { useState, useEffect, useCallback } from 'react';
import { createApiClient } from '@/utils/apiClient';

export function useNotifications(apiKey) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPolling, setIsPolling] = useState(true);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);
  const [lastErrorTime, setLastErrorTime] = useState(null);

  const apiClient = createApiClient(apiKey);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!apiKey) return;

    // Check if we should skip this request due to recent errors
    const now = Date.now();
    const timeSinceLastError = lastErrorTime ? now - lastErrorTime : Infinity;
    const backoffTime = Math.min(30000 * Math.pow(2, consecutiveErrors), 300000); // Max 5 minutes
    
    if (consecutiveErrors >= 3 && timeSinceLastError < backoffTime) {
      console.log(`Skipping notification fetch due to consecutive errors. Backoff: ${backoffTime}ms`);
      return;
    }

    // Don't show loading state if we already have notifications
    if (notifications.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.getNotifications();
      
      if (response.success) {
        // Reset error state on successful fetch
        setConsecutiveErrors(0);
        setLastErrorTime(null);
        
        // Handle different response formats from TorBox API
        let notificationData = [];
        
        if (response.data) {
          if (Array.isArray(response.data)) {
            notificationData = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            // Nested data structure
            notificationData = response.data.data;
          } else if (typeof response.data === 'object') {
            // Single notification object
            notificationData = [response.data];
          }
        } else if (Array.isArray(response)) {
          // Direct array response
          notificationData = response;
        }
        
        // Filter out notifications that have been cleared locally (due to TorBox API bug)
        let clearedNotifications = [];
        try {
          clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
        } catch (error) {
          console.error('Error reading cleared notifications from localStorage:', error);
        }
        
        const filteredNotifications = notificationData.filter(notification => 
          !clearedNotifications.includes(notification.id)
        );
        
        // Get read notifications from localStorage
        let readNotifications = [];
        try {
          readNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
        } catch (error) {
          console.error('Error reading read status from localStorage:', error);
        }
        
        // Apply read status from localStorage
        const notificationsWithReadStatus = filteredNotifications.map(notification => ({
          ...notification,
          read: notification.read || readNotifications.includes(notification.id)
        }));
        
        setNotifications(notificationsWithReadStatus);
        const unread = notificationsWithReadStatus.filter(notification => !notification.read).length;
        setUnreadCount(unread);
      } else {
        const errorMsg = response.error || 'Failed to fetch notifications';
        setError(errorMsg);
        setConsecutiveErrors(prev => prev + 1);
        setLastErrorTime(now);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      
      // Check if it's a connection timeout or network error
      const isConnectionError = error.message?.includes('Connect Timeout Error') || 
                               error.message?.includes('fetch failed') ||
                               error.message?.includes('NetworkError') ||
                               error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';
      
      if (isConnectionError) {
        setConsecutiveErrors(prev => prev + 1);
        setLastErrorTime(now);
        setError('Connection timeout - notifications temporarily unavailable');
        
        // Stop polling after 3 consecutive connection errors
        if (consecutiveErrors >= 2) {
          setIsPolling(false);
          console.log('Stopping notification polling due to consecutive connection errors');
        }
      } else {
        // Only set error for non-connection errors
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiClient, notifications.length, consecutiveErrors, lastErrorTime]);

  // Clear all notifications
  const clearAllNotifications = useCallback(async () => {
    if (!apiKey) return { success: false, error: 'No API key provided' };

    try {
      const response = await apiClient.clearAllNotifications();
      
      if (response && response.success) {
        // Store all current notification IDs as cleared to prevent them from showing up again
        try {
          const currentNotificationIds = notifications.map(n => n.id);
          const clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
          const updatedClearedNotifications = [...new Set([...clearedNotifications, ...currentNotificationIds])];
          localStorage.setItem('clearedNotifications', JSON.stringify(updatedClearedNotifications));
        } catch (error) {
          console.error('Error storing cleared notifications in localStorage:', error);
        }
        
        setNotifications([]);
        setUnreadCount(0);
        // Clear read status from localStorage
        try {
          localStorage.removeItem('readNotifications');
        } catch (error) {
          console.error('Error clearing read status from localStorage:', error);
        }
        return { 
          success: true, 
          message: 'All notifications cleared successfully'
        };
      } else {
        const errorMsg = response?.error || response?.detail || 'Failed to clear notifications';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      return { success: false, error: error.message };
    }
  }, [apiKey, apiClient, notifications]);

  // Clear specific notification
  const clearNotification = useCallback(async (notificationId) => {
    if (!apiKey) return { success: false, error: 'No API key provided' };

    try {
      const response = await apiClient.clearNotification(notificationId);
      
      if (response && response.success) {
        // Verify that the notification was actually cleared by fetching again
        setTimeout(async () => {
          try {
            const verifyResponse = await apiClient.getNotifications();
            if (verifyResponse.success) {
              const remainingNotifications = Array.isArray(verifyResponse.data) ? verifyResponse.data : (verifyResponse.data?.data || []);
              const stillExists = remainingNotifications.some(n => n.id === notificationId);
              if (stillExists) {
                console.warn('Notification was not actually cleared by TorBox API - this appears to be a TorBox API bug');
              }
            }
          } catch (error) {
            console.error('Error verifying notification clear:', error);
          }
        }, 1000);
        
        // Store cleared notifications in localStorage to prevent them from showing up again
        try {
          const clearedNotifications = JSON.parse(localStorage.getItem('clearedNotifications') || '[]');
          if (!clearedNotifications.includes(notificationId)) {
            clearedNotifications.push(notificationId);
            localStorage.setItem('clearedNotifications', JSON.stringify(clearedNotifications));
          }
        } catch (error) {
          console.error('Error storing cleared notification in localStorage:', error);
        }
        
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
        
        return { 
          success: true, 
          message: 'Notification cleared successfully'
        };
      } else {
        const errorMsg = response?.error || response?.detail || 'Failed to clear notification';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error clearing notification:', error);
      return { success: false, error: error.message };
    }
  }, [apiKey, apiClient]);

  // Test notifications
  const testNotification = useCallback(async () => {
    if (!apiKey) return { success: false, error: 'No API key provided' };

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

  // Manual retry function
  const retryFetch = useCallback(() => {
    setConsecutiveErrors(0);
    setLastErrorTime(null);
    setError(null);
    setIsPolling(true);
    fetchNotifications();
  }, [fetchNotifications]);

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
  }, [apiKey, isPolling, fetchNotifications]);

  // Reset error state when API key changes
  useEffect(() => {
    setConsecutiveErrors(0);
    setLastErrorTime(null);
    setError(null);
  }, [apiKey]);

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
    retryFetch,
    consecutiveErrors,
  };
}
