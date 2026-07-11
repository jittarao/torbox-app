import { describe, expect, test } from 'bun:test';
import { timeAgo } from '../formatters';

const t = (key) => {
  const labels = {
    'time.ago': 'ago',
    'time.in': 'in',
    'time.s': 's',
    'time.m': 'm',
    'time.h': 'h',
    'time.d': 'd',
    'time.mo': 'mo',
    'time.y': 'y',
  };
  return labels[key] ?? key;
};

describe('timeAgo', () => {
  test('treats SQLite UTC datetime the same as ISO UTC', () => {
    const sqlite = '2024-06-15 12:00:00';
    const iso = '2024-06-15T12:00:00Z';
    expect(timeAgo(sqlite, t)).toBe(timeAgo(iso, t));
  });

  test('accepts Date instances', () => {
    const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(timeAgo(date, t)).toBe('2h ago');
  });
});
