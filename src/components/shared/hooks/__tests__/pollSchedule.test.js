import { describe, expect, it } from 'bun:test';
import { createPollSchedule } from '../pollSchedule';

describe('pollSchedule', () => {
  it('creates active schedule with next poll timestamp', () => {
    const schedule = createPollSchedule('active', 1_000, 15_000);
    expect(schedule.mode).toBe('active');
    expect(schedule.nextPollAt).toBe(1_000);
    expect(schedule.intervalMs).toBe(15_000);
  });

  it('creates inactive schedule without next poll', () => {
    const schedule = createPollSchedule('inactive', null, 0);
    expect(schedule.mode).toBe('inactive');
    expect(schedule.nextPollAt).toBeNull();
  });
});

describe('all-tab poll stagger config', () => {
  it('stagger fits within active poll interval', async () => {
    const { POLLING_CONFIG } = await import('../pollingConfig');
    const totalStagger = POLLING_CONFIG.allTabStaggerMs * 2;
    expect(totalStagger).toBeLessThan(POLLING_CONFIG.activeIntervalMs);
  });
});
