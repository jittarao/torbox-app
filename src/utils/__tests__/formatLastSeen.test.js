import { describe, expect, test } from 'bun:test';
import { formatLastSeen } from '@/utils/formatLastSeen';

const NOW = new Date('2026-07-10T12:00:00Z');

describe('formatLastSeen', () => {
  test('returns Online when isOnline flag set', () => {
    expect(formatLastSeen(null, { isOnline: true, now: NOW })).toBe('Online');
  });

  test('returns Never when no timestamp', () => {
    expect(formatLastSeen(null, { now: NOW })).toBe('Never');
  });

  test('returns minutes ago for recent activity', () => {
    const seen = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatLastSeen(seen, { now: NOW })).toBe('5 min ago');
  });

  test('returns hours ago', () => {
    const seen = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatLastSeen(seen, { now: NOW })).toBe('2 hours ago');
  });

  test('returns Yesterday for prior UTC day', () => {
    const seen = '2026-07-09 08:00:00';
    expect(formatLastSeen(seen, { now: NOW })).toBe('Yesterday');
  });

  test('formats older dates in UTC', () => {
    const seen = '2026-06-01 08:00:00';
    expect(formatLastSeen(seen, { now: NOW })).toBe('Jun 1, 2026');
  });
});
