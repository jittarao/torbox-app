import { describe, it, expect } from 'bun:test';
import { withTimeout } from '../PollingScheduler.js';

describe('PollingScheduler withTimeout', () => {
  it('resolves when the inner promise settles before the deadline', async () => {
    const result = await withTimeout(Promise.resolve(42), 500, 'should not fire');
    expect(result).toBe(42);
  });

  it('rejects with TimeoutError when the promise is too slow', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 2000));
    await expect(withTimeout(slow, 30, 'timed out')).rejects.toMatchObject({
      name: 'TimeoutError',
      isTimeout: true,
    });
  });

  it('invokes onTimeout callback when deadline is exceeded', async () => {
    let cancelled = false;
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 2000));
    await expect(
      withTimeout(slow, 30, 'timed out', { onTimeout: () => (cancelled = true) })
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(cancelled).toBe(true);
  });
});
