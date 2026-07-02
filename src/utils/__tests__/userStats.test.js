import { describe, expect, test } from 'bun:test';
import { getUserStatsErrorMessage } from '@/utils/userStats';

describe('getUserStatsErrorMessage', () => {
  test('prefers specific error over UNKNOWN_ERROR', () => {
    expect(
      getUserStatsErrorMessage(
        { error: 'UNKNOWN_ERROR', detail: 'Please try again later.' },
        'fallback'
      )
    ).toBe('Please try again later.');
  });

  test('returns specific error when present', () => {
    expect(getUserStatsErrorMessage({ error: 'Unauthorized' }, 'fallback')).toBe('Unauthorized');
  });

  test('falls back when no message fields', () => {
    expect(getUserStatsErrorMessage({}, 'fallback')).toBe('fallback');
  });
});
