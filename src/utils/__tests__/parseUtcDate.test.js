import { describe, expect, test } from 'bun:test';
import { parseUtcDate } from '../parseUtcDate';

describe('parseUtcDate', () => {
  test('parses SQLite UTC datetime as UTC', () => {
    const sqlite = '2024-06-15 12:00:00';
    expect(parseUtcDate(sqlite).getTime()).toBe(Date.UTC(2024, 5, 15, 12, 0, 0));
  });

  test('parses ISO without Z as UTC', () => {
    expect(parseUtcDate('2024-06-15T12:00:00').toISOString()).toBe('2024-06-15T12:00:00.000Z');
  });

  test('passes through numeric timestamps', () => {
    const ms = Date.UTC(2024, 5, 15, 12, 0, 0);
    expect(parseUtcDate(ms).getTime()).toBe(ms);
  });

  test('passes through Date instances', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));
    expect(parseUtcDate(date)).toBe(date);
  });

  test('parses ISO with timezone offset as-is', () => {
    expect(parseUtcDate('2024-06-15T12:00:00+05:30').toISOString()).toBe(
      '2024-06-15T06:30:00.000Z'
    );
  });
});
