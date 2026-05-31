import { describe, expect, test, beforeEach } from 'bun:test';
import {
  registerPollTimerReset,
  resetPollTimer,
  unregisterPollTimerReset,
} from '@/store/pollTimerReset';

describe('pollTimerReset', () => {
  beforeEach(() => {
    unregisterPollTimerReset();
  });

  test('resetPollTimer invokes registered callback', () => {
    let called = 0;
    registerPollTimerReset(() => {
      called += 1;
    });

    resetPollTimer();
    expect(called).toBe(1);
  });

  test('resetPollTimer is a no-op when nothing registered', () => {
    expect(() => resetPollTimer()).not.toThrow();
  });

  test('unregisterPollTimerReset clears callback', () => {
    let called = 0;
    registerPollTimerReset(() => {
      called += 1;
    });
    unregisterPollTimerReset();

    resetPollTimer();
    expect(called).toBe(0);
  });
});
