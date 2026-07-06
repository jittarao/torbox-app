import { describe, expect, test } from 'bun:test';
import { getPlayerFormFactor } from '../usePlayerLayout';

describe('usePlayerFormFactor', () => {
  test('getPlayerFormFactor returns portrait or landscape', () => {
    const factor = getPlayerFormFactor();
    expect(['portrait', 'landscape']).toContain(factor);
  });
});
