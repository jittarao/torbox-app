import { describe, expect, test } from 'bun:test';
import { getTouchPlayer } from '../useTouchPlayer';

describe('useTouchPlayer', () => {
  test('getTouchPlayer returns boolean', () => {
    expect(typeof getTouchPlayer()).toBe('boolean');
  });
});
