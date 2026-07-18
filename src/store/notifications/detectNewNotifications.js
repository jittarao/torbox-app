import { getJSON, setItem } from '@/utils/storage';

const OS_NOTIFIED_STORAGE_KEY = 'osNotifiedNotifications:v1';
const MAX_OS_NOTIFIED_IDS = 500;

/**
 * Returns notifications present in `next` whose id was not in `previous`.
 */
export function findNewNotifications(previous, next) {
  if (!Array.isArray(next) || next.length === 0) {
    return [];
  }

  const previousIds = new Set((previous ?? []).map((notification) => notification.id));
  return next.filter((notification) => !previousIds.has(notification.id));
}

export function loadOsNotifiedIds() {
  const stored = getJSON(OS_NOTIFIED_STORAGE_KEY);
  return new Set(Array.isArray(stored) ? stored : []);
}

export function filterAlreadyOsNotified(newItems, osNotifiedSet) {
  return newItems.filter((notification) => !osNotifiedSet.has(notification.id));
}

export function persistOsNotifiedIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return;
  }

  const existing = loadOsNotifiedIds();
  for (const id of ids) {
    existing.add(id);
  }

  const merged = [...existing];
  const trimmed =
    merged.length > MAX_OS_NOTIFIED_IDS
      ? merged.slice(merged.length - MAX_OS_NOTIFIED_IDS)
      : merged;

  setItem(OS_NOTIFIED_STORAGE_KEY, JSON.stringify(trimmed));
}

export const TORBOX_NOTIFICATION_BATCH_LIMIT = 3;

/**
 * Builds native notification payloads for new TorBox items.
 * Shows up to TORBOX_NOTIFICATION_BATCH_LIMIT individual alerts, then one summary.
 */
export function buildTorboxNativeNotificationPayloads(newItems) {
  if (!Array.isArray(newItems) || newItems.length === 0) {
    return [];
  }

  const payloads = newItems.slice(0, TORBOX_NOTIFICATION_BATCH_LIMIT).map((notification) => ({
    id: notification.id,
    title: notification.title || 'TorBox',
    body: notification.message || '',
  }));

  const remaining = newItems.length - TORBOX_NOTIFICATION_BATCH_LIMIT;
  if (remaining > 0) {
    payloads.push({
      id: null,
      title: 'TorBox',
      body: `${remaining} more TorBox notification${remaining === 1 ? '' : 's'}`,
    });
  }

  return payloads;
}
