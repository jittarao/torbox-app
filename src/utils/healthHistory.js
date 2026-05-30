import { getItem, setItem } from '@/utils/storage';

const HEALTH_HISTORY_LENGTH = 30;
const STORAGE_KEY = 'torbox-health-history-v2';

export function statusToSegment(status, responseTime) {
  if (status === 'healthy') {
    if (responseTime != null && responseTime > 3000) {
      return 'degraded';
    }
    return 'up';
  }
  if (status === 'unhealthy') {
    return 'down';
  }
  return 'unknown';
}

export function appendHistoryEntry(history, segment) {
  if (segment === 'unknown') {
    return history;
  }

  const entry = { s: segment, at: Date.now() };
  const next = [...history, entry];
  if (next.length > HEALTH_HISTORY_LENGTH) {
    return next.slice(-HEALTH_HISTORY_LENGTH);
  }
  return next;
}

export function padHistoryForDisplay(history, currentStatus) {
  if (history.length === 0 && currentStatus === 'unhealthy') {
    return Array(HEALTH_HISTORY_LENGTH).fill({ s: 'down', at: null });
  }

  const bar = Array(HEALTH_HISTORY_LENGTH).fill({ s: 'up', at: null });
  const start = Math.max(0, HEALTH_HISTORY_LENGTH - history.length);

  for (let i = 0; i < history.length; i++) {
    bar[start + i] = history[i];
  }

  return bar;
}

export function calculateUptimePercent(history, currentStatus = 'unknown') {
  if (history.length === 0) {
    return currentStatus === 'unhealthy' ? 0 : 100;
  }

  let score = 0;
  for (const entry of history) {
    if (entry.s === 'up') score += 1;
    else if (entry.s === 'degraded') score += 0.5;
  }

  return (score / history.length) * 100;
}

/** @returns {Array<{s: string, at: number|null}>} */
export function loadHealthHistory() {
  if (typeof window === 'undefined') return [];
  const raw = getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHealthHistory(history) {
  if (typeof window === 'undefined') return;
  setItem(STORAGE_KEY, JSON.stringify(history));
}
