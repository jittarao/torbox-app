import { describe, expect, test } from 'bun:test';
import { formatTrackerLabel } from '../trackerDisplay';

describe('formatTrackerLabel', () => {
  test('returns hostname for valid tracker urls', () => {
    expect(formatTrackerLabel('https://tracker.example.com/announce')).toBe('tracker.example.com');
    expect(formatTrackerLabel('http://tracker.example.com:8080/announce')).toBe(
      'tracker.example.com:8080'
    );
  });

  test('truncates long non-url strings', () => {
    const long = 'x'.repeat(50);
    expect(formatTrackerLabel(long)).toBe(`${'x'.repeat(37)}…`);
  });

  test('returns empty string for blank input', () => {
    expect(formatTrackerLabel('')).toBe('');
    expect(formatTrackerLabel(null)).toBe('');
  });
});
