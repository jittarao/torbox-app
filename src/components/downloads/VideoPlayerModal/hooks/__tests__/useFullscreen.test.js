import { describe, expect, test } from 'bun:test';
import { isIOS } from '../../utils/fullscreen';

describe('fullscreen utils', () => {
  test('isIOS returns boolean', () => {
    expect(typeof isIOS()).toBe('boolean');
  });
});
