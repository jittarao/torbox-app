import { describe, expect, test } from 'bun:test';
import { createThrottledLogger } from '../logThrottle.js';

describe('createThrottledLogger', () => {
  test('emits once per TTL then suppresses with debug', () => {
    const calls = { warn: [], debug: [] };
    const throttled = createThrottledLogger({
      warn: (msg, meta) => calls.warn.push({ msg, meta }),
      debug: (msg, meta) => calls.debug.push({ msg, meta }),
    });

    const first = throttled.log(
      'warn',
      'defer:webdl',
      'TorBox API unavailable',
      { type: 'webdl' },
      60_000
    );
    const second = throttled.log(
      'warn',
      'defer:webdl',
      'TorBox API unavailable',
      { type: 'webdl' },
      60_000
    );

    expect(first.emitted).toBe(true);
    expect(second.emitted).toBe(false);
    expect(calls.warn).toHaveLength(1);
    expect(calls.debug).toHaveLength(1);
    expect(calls.debug[0].meta.quiet).toBe(true);
  });

  test('attaches suppressedSimilar on next emit after TTL elapses', async () => {
    const calls = { warn: [], debug: [] };
    const throttled = createThrottledLogger({
      warn: (msg, meta) => calls.warn.push({ msg, meta }),
      debug: (msg, meta) => calls.debug.push({ msg, meta }),
    });

    throttled.log('warn', 'k', 'msg', {}, 5);
    throttled.log('warn', 'k', 'msg', {}, 5);
    await Bun.sleep(10);
    const third = throttled.log('warn', 'k', 'msg', {}, 5);

    expect(third.emitted).toBe(true);
    expect(third.suppressedCount).toBe(1);
    expect(calls.warn).toHaveLength(2);
    expect(calls.warn[1].meta.suppressedSimilar).toBe(1);
  });
});
