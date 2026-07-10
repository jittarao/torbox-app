import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import ActivityTracker, { ONLINE_WINDOW_MS, PERSIST_INTERVAL_MS } from '../ActivityTracker.js';

function createMockMaster() {
  const batches = [];
  return {
    batches,
    touchUserActivityBatch(entries) {
      this.batches.push(entries);
    },
  };
}

describe('ActivityTracker', () => {
  let master;
  let tracker;

  beforeEach(() => {
    master = createMockMaster();
    tracker = new ActivityTracker(master, {
      persistIntervalMs: PERSIST_INTERVAL_MS,
      onlineWindowMs: ONLINE_WINDOW_MS,
      flushIntervalMs: 60_000,
    });
  });

  afterEach(() => {
    tracker.stop();
  });

  test('touch marks user online immediately', () => {
    tracker.touch('user-a');
    expect(tracker.isOnline('user-a')).toBe(true);
    expect(tracker.getOnlineCount()).toBe(1);
  });

  test('does not queue persist before interval elapses', () => {
    const t0 = new Date('2026-01-01T12:00:00Z');
    tracker.touch('user-a', t0);
    tracker.flush();
    expect(master.batches).toHaveLength(1);

    tracker.touch('user-a', new Date(t0.getTime() + 60_000));
    tracker.flush();
    expect(master.batches).toHaveLength(1);
  });

  test('queues persist after 5 minute interval', () => {
    const t0 = new Date('2026-01-01T12:00:00Z');
    tracker.touch('user-a', t0);
    tracker.flush();

    tracker.touch('user-a', new Date(t0.getTime() + PERSIST_INTERVAL_MS));
    tracker.flush();
    expect(master.batches).toHaveLength(2);
    expect(master.batches[1][0].authId).toBe('user-a');
  });

  test('flush writes pending batch and updates lastPersistedAt', () => {
    const at = new Date('2026-01-01T12:00:00Z');
    tracker.touch('user-a', at);
    tracker.flush();
    expect(master.batches[0][0].at).toEqual(at);
  });

  test('user is offline after online window expires', () => {
    const shortWindowTracker = new ActivityTracker(master, {
      onlineWindowMs: 1000,
      flushIntervalMs: 60_000,
    });
    const old = new Date(Date.now() - 5000);
    shortWindowTracker.touch('user-a', old);
    expect(shortWindowTracker.isOnline('user-a')).toBe(false);
    shortWindowTracker.stop();
  });

  test('flush retains pending entries when database write fails', () => {
    const failingMaster = {
      touchUserActivityBatch() {
        throw new Error('db unavailable');
      },
    };
    const failingTracker = new ActivityTracker(failingMaster, { flushIntervalMs: 60_000 });
    const at = new Date('2026-01-01T12:00:00Z');
    failingTracker.touch('user-a', at);

    expect(() => failingTracker.flush()).toThrow('db unavailable');
    expect(failingTracker._pending.size).toBe(1);
    expect(failingTracker._pending.get('user-a')).toBe(at.getTime());
    failingTracker.stop();
  });

  test('pruneStaleMemory evicts entries older than max age', () => {
    const staleAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    tracker.touch('stale-user', staleAt);
    tracker.touch('fresh-user');

    tracker.pruneStaleMemory();

    expect(tracker._memory.has('stale-user')).toBe(false);
    expect(tracker._memory.has('fresh-user')).toBe(true);
    expect(tracker.isOnline('fresh-user')).toBe(true);
  });
});
