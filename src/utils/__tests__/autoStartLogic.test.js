import { describe, expect, test } from 'bun:test';
import {
  coerceAutoStartLimit,
  computeAutoStartPlan,
  countQueuedItems,
  isActiveDownload,
  isQueuedItem,
  pruneProcessedIdsMap,
} from '../autoStartLogic';

describe('autoStartLogic', () => {
  test('isQueuedItem matches status queued', () => {
    expect(isQueuedItem({ status: 'queued' })).toBe(true);
    expect(isQueuedItem({ status: 'Queued' })).toBe(true);
    expect(isQueuedItem({ active: false })).toBe(false);
  });

  test('isActiveDownload handles boolean, number, and string', () => {
    expect(isActiveDownload({ active: true })).toBe(true);
    expect(isActiveDownload({ active: 1 })).toBe(true);
    expect(isActiveDownload({ active: 'true' })).toBe(true);
    expect(isActiveDownload({ active: false })).toBe(false);
  });

  test('coerceAutoStartLimit caps and defaults', () => {
    expect(coerceAutoStartLimit(10)).toBe(10);
    expect(coerceAutoStartLimit(9999)).toBe(999);
    expect(coerceAutoStartLimit(undefined)).toBe(3);
  });

  test('computeAutoStartPlan selects queued ids up to available slots', () => {
    const processed = new Map();
    const items = [
      { id: 1, active: true },
      { id: 2, active: true },
      { id: 10, status: 'queued' },
      { id: 11, status: 'queued' },
      { id: 12, status: 'queued' },
    ];

    const plan = computeAutoStartPlan(items, 10, processed, Date.now(), 90_000);

    expect(plan.activeCount).toBe(2);
    expect(plan.queuedCount).toBe(3);
    expect(plan.slotsAvailable).toBe(8);
    expect(plan.toStart).toEqual([10, 11, 12]);
  });

  test('computeAutoStartPlan skips recently processed ids', () => {
    const processed = new Map([[10, Date.now()]]);
    const items = [
      { id: 10, status: 'queued' },
      { id: 11, status: 'queued' },
    ];

    const plan = computeAutoStartPlan(items, 10, processed, Date.now(), 90_000);
    expect(plan.toStart).toEqual([11]);
  });

  test('pruneProcessedIdsMap removes ids no longer queued', () => {
    const processed = new Map([
      [1, Date.now()],
      [2, Date.now()],
    ]);

    pruneProcessedIdsMap(processed, [{ id: 2, status: 'queued' }]);

    expect(processed.has(1)).toBe(false);
    expect(processed.has(2)).toBe(true);
  });

  test('countQueuedItems counts queued rows only', () => {
    expect(
      countQueuedItems([{ status: 'queued' }, { status: 'downloading' }, { status: 'queued' }])
    ).toBe(2);
  });
});
