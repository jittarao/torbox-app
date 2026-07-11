import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import GlobalActionQueue from '../GlobalActionQueue.js';
import { INACTIVITY_RECHECK_INTERVAL_MS } from '../../config/automationInactivity.js';

const ENV_KEY = 'AUTOMATION_INACTIVE_USER_DAYS';

describe('GlobalActionQueue', () => {
  let scheduler;
  let queue;
  let savedEnv;

  beforeEach(() => {
    savedEnv = process.env[ENV_KEY];
    process.env[ENV_KEY] = '30';

    scheduler = {
      masterDb: {
        batchInsertPendingActions: (batch) => batch.map((_, i) => i + 1),
        deletePendingAction: () => {},
      },
      runActionBatch: async () => {},
      recordInactivitySkip: () => {},
      isAutomationRuleEnabled: async () => true,
    };
    queue = new GlobalActionQueue(scheduler);
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = savedEnv;
    }
  });

  it('persists pending actions and assigns pendingId', async () => {
    const descriptors = [
      {
        authId: 'a'.repeat(64),
        rule: { id: 1, name: 'r1' },
        torrentsToProcess: [{ id: 't1' }],
      },
    ];
    queue.enqueue(descriptors);
    await new Promise((r) => setTimeout(r, 50));
    expect(descriptors[0].pendingId).toBe(1);
  });

  it('falls back to memory queue when persist fails', async () => {
    scheduler.masterDb.batchInsertPendingActions = () => {
      throw new Error('db down');
    };
    queue.drain = async () => {};
    const descriptors = [
      {
        authId: 'b'.repeat(64),
        rule: { id: 2, name: 'r2' },
        torrentsToProcess: [{ id: 't2' }],
      },
    ];
    queue.enqueue(descriptors);
    expect(queue.pending.length).toBe(1);
    expect(descriptors[0].pendingId).toBeUndefined();
  });

  it('loadFromPersistence restores rows and drains', async () => {
    scheduler.masterDb.getAllPendingActions = () => [
      {
        id: 99,
        payload: JSON.stringify({
          authId: 'c'.repeat(64),
          rule: { id: 3, name: 'r3' },
          torrentsToProcess: [{ id: 't3' }],
        }),
      },
    ];
    let batchRan = false;
    scheduler.runActionBatch = async () => {
      batchRan = true;
    };
    await queue.loadFromPersistence();
    await new Promise((r) => setTimeout(r, 50));
    expect(batchRan).toBe(true);
  });

  it('re-pushes inactive user items with deferral and does not run action batch', async () => {
    const authId = 'd'.repeat(64);
    let batchRan = false;
    let deleteCalled = false;

    scheduler.masterDb.getUserRegistryInfo = () => ({
      auth_id: authId,
      last_seen_at: '2026-06-01 00:00:00',
    });
    scheduler.masterDb.deletePendingAction = () => {
      deleteCalled = true;
    };
    scheduler.runActionBatch = async () => {
      batchRan = true;
    };
    scheduler.recordInactivitySkip = (kind) => {
      expect(kind).toBe('queue');
    };

    const descriptor = {
      authId,
      rule: { id: 4, name: 'r4' },
      torrentsToProcess: [{ id: 't4' }],
      pendingId: 10,
    };

    queue.pending = [descriptor];
    await queue.drain();

    expect(batchRan).toBe(false);
    expect(deleteCalled).toBe(false);
    expect(queue.pending).toHaveLength(1);
    expect(queue.pending[0]._deferDrainUntil).toBeGreaterThan(Date.now());
    expect(queue.pending[0]._deferDrainUntil).toBeLessThanOrEqual(
      Date.now() + INACTIVITY_RECHECK_INTERVAL_MS + 50
    );
  });

  it('does not re-evaluate deferred inactive items on immediate next drain', async () => {
    const authId = 'e'.repeat(64);
    let lookupCount = 0;

    scheduler.masterDb.getUserRegistryInfo = () => {
      lookupCount += 1;
      return { auth_id: authId, last_seen_at: '2026-06-01 00:00:00' };
    };
    scheduler.runActionBatch = async () => {};

    const descriptor = {
      authId,
      rule: { id: 5, name: 'r5' },
      torrentsToProcess: [{ id: 't5' }],
      pendingId: 11,
      _deferDrainUntil: Date.now() + INACTIVITY_RECHECK_INTERVAL_MS,
    };

    queue.pending = [descriptor];
    await queue.drain();

    expect(lookupCount).toBe(0);
    expect(queue.pending).toHaveLength(1);
  });

  it('skips pending action batch when rule is disabled', async () => {
    const authId = 'f'.repeat(64);
    let batchRan = false;
    let deleteCalled = false;

    scheduler.isAutomationRuleEnabled = async () => false;
    scheduler.masterDb.deletePendingAction = () => {
      deleteCalled = true;
    };
    scheduler.runActionBatch = async () => {
      batchRan = true;
    };

    queue.pending = [
      {
        authId,
        rule: { id: 6, name: 'disabled-rule' },
        torrentsToProcess: [{ id: 't6' }],
        pendingId: 12,
      },
    ];

    await queue.drain();

    expect(batchRan).toBe(false);
    expect(deleteCalled).toBe(true);
    expect(queue.pending).toHaveLength(0);
  });

  it('removePendingForRule drops in-memory queued batches', () => {
    const authId = 'g'.repeat(64);
    queue.pending = [
      {
        authId,
        rule: { id: 7, name: 'r7' },
        torrentsToProcess: [{ id: 't7' }],
      },
      {
        authId,
        rule: { id: 8, name: 'r8' },
        torrentsToProcess: [{ id: 't8' }],
      },
    ];

    queue.removePendingForRule(authId, 7);
    expect(queue.pending).toHaveLength(1);
    expect(queue.pending[0].rule.id).toBe(8);
  });
});
