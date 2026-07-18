'use client';

import { useEffect, useRef } from 'react';
import { showTorboxNotification } from '@/desktop/desktopBridge';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useDesktopStore } from '@/store/desktopStore';
import { getUserPresenceSnapshot } from '@/store/userPresenceStore';
import {
  buildTorboxNativeNotificationPayloads,
  filterAlreadyOsNotified,
  findNewNotifications,
  loadOsNotifiedIds,
  persistOsNotifiedIds,
} from '@/store/notifications/detectNewNotifications';

/**
 * Shows native OS notifications when TorBox account notifications arrive while the user is disengaged.
 * Desktop (Tauri) only — no-ops in the browser.
 */
export function useTorboxNativeNotifications(apiKey) {
  const previousNotificationsRef = useRef([]);
  const baselineEstablishedRef = useRef(false);
  const notifications = useNotificationsStore((state) => state.notifications);
  const notificationsBaselineEstablished = useNotificationsStore(
    (state) => state.notificationsBaselineEstablished
  );
  const refreshNotificationSettings = useDesktopStore((state) => state.refreshNotificationSettings);
  const notificationSettings = useDesktopStore((state) => state.notificationSettings);

  useEffect(() => {
    if (!notificationSettings) {
      refreshNotificationSettings();
    }
  }, [notificationSettings, refreshNotificationSettings]);

  useEffect(() => {
    baselineEstablishedRef.current = false;
    previousNotificationsRef.current = [];
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey || !notificationsBaselineEstablished) {
      return;
    }

    const previousNotifications = previousNotificationsRef.current;

    if (!baselineEstablishedRef.current) {
      baselineEstablishedRef.current = true;
      previousNotificationsRef.current = notifications;
      return;
    }

    if (previousNotifications === notifications) {
      return;
    }

    const newItems = findNewNotifications(previousNotifications, notifications);
    previousNotificationsRef.current = notifications;

    if (newItems.length === 0) {
      return;
    }

    const settings = useDesktopStore.getState().notificationSettings;
    if (!settings?.nativeNotifications || !settings?.notifyOnTorboxNotifications) {
      return;
    }

    if (!getUserPresenceSnapshot().isDisengaged()) {
      return;
    }

    const osNotifiedIds = loadOsNotifiedIds();
    const itemsToNotify = filterAlreadyOsNotified(newItems, osNotifiedIds);
    if (itemsToNotify.length === 0) {
      return;
    }

    const payloads = buildTorboxNativeNotificationPayloads(itemsToNotify);
    const shownIds = [];

    void (async () => {
      for (const payload of payloads) {
        try {
          const shown = await showTorboxNotification(payload.title, payload.body);
          if (shown && payload.id != null) {
            shownIds.push(payload.id);
          }
        } catch (error) {
          console.error('Failed to show TorBox native notification:', error);
        }
      }

      if (shownIds.length > 0) {
        persistOsNotifiedIds(shownIds);
      }
    })();
  }, [apiKey, notifications, notificationsBaselineEstablished]);
}
