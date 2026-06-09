import { describe, it, expect, beforeEach, mock } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';

describe('PollingScheduler.runActionBatch tag notifications', () => {
  let scheduler;
  let notify;

  beforeEach(() => {
    notify = mock(() => {});
    scheduler = new PollingScheduler(
      { getUserDatabase: async () => ({ db: {} }) },
      {
        getUserRegistryInfo: (authId) =>
          authId === 'user-1' ? { encrypted_key: 'enc-key' } : null,
      },
      null
    );
    scheduler.eventNotifier = { notify };
    scheduler.createEngineForPoll = async () => ({
      ruleExecutor: {
        executeActions: async () => ({ successCount: 2, errorCount: 0 }),
      },
      ruleRepository: {
        recordExecution: async () => {},
        updateLastEvaluatedAt: async () => {},
      },
    });
    scheduler._teardownEngineForAuth = () => {};
  });

  it('emits tags_changed after successful add_tag batch', async () => {
    await scheduler.runActionBatch({
      authId: 'user-1',
      rule: { id: 1, name: 'Tag rule', action: { type: 'add_tag', tagIds: [1] } },
      torrentsToProcess: [{ id: '10' }, { id: '11' }],
    });

    expect(notify).toHaveBeenCalledWith('user-1', { event: 'tags_changed' });
  });

  it('does not emit tags_changed for non-tag actions', async () => {
    await scheduler.runActionBatch({
      authId: 'user-1',
      rule: { id: 2, name: 'Delete rule', action: { type: 'delete' } },
      torrentsToProcess: [{ id: '10' }],
    });

    expect(notify).not.toHaveBeenCalled();
  });

  it('does not emit tags_changed when all actions failed', async () => {
    scheduler.createEngineForPoll = async () => ({
      ruleExecutor: {
        executeActions: async () => ({ successCount: 0, errorCount: 1 }),
      },
      ruleRepository: {
        recordExecution: async () => {},
        updateLastEvaluatedAt: async () => {},
      },
    });

    await scheduler.runActionBatch({
      authId: 'user-1',
      rule: { id: 3, name: 'Tag rule', action: { type: 'remove_tag', tagIds: [1] } },
      torrentsToProcess: [{ id: '10' }],
    });

    expect(notify).not.toHaveBeenCalled();
  });
});
