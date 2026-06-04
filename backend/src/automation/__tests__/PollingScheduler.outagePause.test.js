import { describe, it, expect, beforeEach } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';
import torboxApiOutageCoordinator from '../../api/TorboxApiOutageCoordinator.js';

describe('PollingScheduler outage pause', () => {
  let scheduler;
  let updateNextPollAtBatchCalls;

  beforeEach(() => {
    torboxApiOutageCoordinator.resetForTests();
    updateNextPollAtBatchCalls = 0;

    scheduler = new PollingScheduler(
      { getUserDatabase: async () => ({ db: {} }) },
      {
        getUsersDueForPolling: () => [
          {
            auth_id: 'user1',
            encrypted_key: 'enc',
            has_active_rules: 1,
          },
        ],
        updateNextPollAtBatch: () => {
          updateNextPollAtBatchCalls += 1;
        },
        getUserRegistryInfo: () => ({ auth_id: 'user1', encrypted_key: 'enc' }),
      },
      null
    );
    scheduler.isRunning = true;
    scheduler.pollSemaphore = { acquire: async () => {}, release: () => {} };
    scheduler.processSemaphore = { acquire: async () => {}, release: () => {} };
  });

  it('skips pollDueUsers when coordinator is paused (no batch reserve)', async () => {
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');

    await scheduler.pollDueUsers();

    expect(updateNextPollAtBatchCalls).toBe(0);
  });

  it('handleConnectionError does not update next_poll_at when paused', () => {
    torboxApiOutageCoordinator.enterPaused('circuit_breaker');
    let updateCalled = false;
    scheduler.masterDb.updateNextPollAt = () => {
      updateCalled = true;
    };

    scheduler.handleConnectionError('user1', 0);

    expect(updateCalled).toBe(false);
  });
});
