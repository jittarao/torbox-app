import { describe, expect, it } from 'bun:test';
import { runWithConcurrency } from '../runWithConcurrency';

describe('runWithConcurrency', () => {
  it('runs all items with at most concurrency workers in flight', async () => {
    const items = [1, 2, 3, 4, 5];
    let inFlight = 0;
    let maxInFlight = 0;
    const order = [];

    await runWithConcurrency(items, 2, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      order.push(`start-${item}`);
      await Bun.sleep(20);
      order.push(`end-${item}`);
      inFlight--;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(order.filter((e) => e.startsWith('start'))).toHaveLength(5);
    expect(order.filter((e) => e.startsWith('end'))).toHaveLength(5);
  });

  it('starts the next task when a slow task is still running', async () => {
    const items = ['slow', 'fast'];
    const startedAt = new Map();

    await runWithConcurrency(items, 2, async (item) => {
      startedAt.set(item, Date.now());
      await Bun.sleep(item === 'slow' ? 80 : 10);
    });

    const fastStart = startedAt.get('fast');
    const slowStart = startedAt.get('slow');
    expect(fastStart - slowStart).toBeLessThan(80);
  });
});
