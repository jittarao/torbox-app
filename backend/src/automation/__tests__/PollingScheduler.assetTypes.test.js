import { describe, it, expect, mock } from 'bun:test';
import PollingScheduler from '../PollingScheduler.js';

describe('PollingScheduler download fetch asset types', () => {
  it('attaches the automation engine before fetching downloads', async () => {
    const scheduler = new PollingScheduler(
      { getUserDatabase: async () => ({ db: {} }) },
      { getUserRegistryInfo: () => null },
      null
    );

    const engine = { isInitialized: true };
    scheduler.createEngineForPoll = mock(async () => engine);

    const poller = {
      automationEngine: null,
      fetchDownloadsForActiveRules: mock(async function () {
        expect(this.automationEngine).toBe(engine);
        return [];
      }),
    };
    scheduler.getOrCreatePoller = mock(async () => poller);

    const result = await scheduler.fetchDownloadsForUser(
      { auth_id: 'user-1', encrypted_key: 'key-1' },
      null
    );

    expect(result.error).toBeUndefined();
    expect(result.downloads).toEqual([]);
    expect(poller.fetchDownloadsForActiveRules).toHaveBeenCalledTimes(1);
  });
});
