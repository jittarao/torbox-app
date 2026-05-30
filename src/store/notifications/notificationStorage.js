import { getJSON, setItem, removeItem } from '@/utils/storage';

export function getClearedNotifications() {
  return getJSON('clearedNotifications:v1') ?? getJSON('clearedNotifications') ?? [];
}

export function getReadNotifications() {
  return getJSON('readNotifications:v1') ?? getJSON('readNotifications') ?? [];
}

export function persistClearedNotificationIds(ids) {
  const cleared = getClearedNotifications();
  const updated = [...new Set([...cleared, ...ids])];
  setItem('clearedNotifications:v1', JSON.stringify(updated));
}

export function persistClearedNotificationId(id) {
  const cleared = getClearedNotifications();
  if (!cleared.includes(id)) {
    cleared.push(id);
    setItem('clearedNotifications:v1', JSON.stringify(cleared));
  }
}

export function persistReadNotificationId(id) {
  const read = getReadNotifications();
  if (!read.includes(id)) {
    read.push(id);
    setItem('readNotifications:v1', JSON.stringify(read));
  }
}

export function persistAllReadNotificationIds(ids) {
  setItem('readNotifications:v1', JSON.stringify(ids));
}

export function removeReadNotificationId(id) {
  const read = getReadNotifications().filter((readId) => readId !== id);
  setItem('readNotifications:v1', JSON.stringify(read));
}

export function clearReadNotifications() {
  removeItem('readNotifications:v1');
}
