import { describe, it, expect, beforeEach } from 'bun:test';
import GlobalActionQueue from '../GlobalActionQueue.js';

describe('GlobalActionQueue', () => {
  let scheduler;
  let queue;

  beforeEach(() => {
    scheduler = {
      masterDb: {
        batchInsertPendingActions: (batch) => batch.map((_, i) => i + 1),
        deletePendingAction: () => {},
      },
      runActionBatch: async () => {},
    };
    queue = new GlobalActionQueue(scheduler);
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
});
