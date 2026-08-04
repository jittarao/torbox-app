import { describe, expect, test, mock } from 'bun:test';
import RuleExecutor from '../helpers/RuleExecutor.js';

describe('RuleExecutor protection', () => {
  test('increments protectedSkippedCount when actions are skipped as protected', async () => {
    const executeAction = mock(async () => ({
      applied: false,
      skipped: true,
      reason: 'protected',
    }));

    const ruleEvaluator = {
      executeAction,
      validateTagIds: () => {},
      getTorrentStatus: () => 'completed',
      extractDownloadId: (torrent) => torrent.id,
      protectionService: {
        getProtectedSet: () => new Set(),
      },
    };

    const executor = new RuleExecutor('auth', async () => ruleEvaluator);
    const result = await executor.executeActions(
      { id: 1, name: 'Delete Rule', action: { type: 'delete' } },
      [{ id: '1' }, { id: '2' }]
    );

    expect(result.protectedSkippedCount).toBe(2);
    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  test('counts successes for non-protected actions', async () => {
    const executeAction = mock(async () => ({ applied: true, success: true }));
    const ruleEvaluator = {
      executeAction,
      validateTagIds: () => {},
      getTorrentStatus: () => 'completed',
      extractDownloadId: (torrent) => torrent.id,
      protectionService: {
        getProtectedSet: () => new Set(),
      },
    };

    const executor = new RuleExecutor('auth', async () => ruleEvaluator);
    const result = await executor.executeActions(
      { id: 1, name: 'Delete Rule', action: { type: 'delete' } },
      [{ id: '1' }]
    );

    expect(result.successCount).toBe(1);
    expect(result.protectedSkippedCount).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  test('aborts remaining force_start actions after active download limit', async () => {
    let calls = 0;
    const executeAction = mock(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error(
          'You have reached your active download limit of 3. Please upgrade your plan.'
        );
        err.isTorboxApplicationError = true;
        err.isActiveDownloadLimit = true;
        throw err;
      }
      return { success: true };
    });

    const ruleEvaluator = {
      executeAction,
      validateTagIds: () => {},
      getTorrentStatus: () => 'queued',
      extractDownloadId: (torrent) => torrent.id,
      protectionService: {
        getProtectedSet: () => new Set(),
      },
    };

    const executor = new RuleExecutor('auth', async () => ruleEvaluator);
    const prevConcurrency = process.env.RULE_ACTION_CONCURRENCY;
    process.env.RULE_ACTION_CONCURRENCY = '1';
    try {
      const result = await executor.executeActions(
        { id: 1, name: 'Start Queued', action: { type: 'force_start' } },
        [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
      );

      expect(calls).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.successCount).toBe(0);
      expect(result.abortedCount).toBe(3);
    } finally {
      if (prevConcurrency === undefined) {
        delete process.env.RULE_ACTION_CONCURRENCY;
      } else {
        process.env.RULE_ACTION_CONCURRENCY = prevConcurrency;
      }
    }
  });

  test('does not count connection soft-fallback as success', async () => {
    const executeAction = mock(async () => ({
      success: false,
      error: 'CONNECTION_ERROR',
      isConnectionError: true,
      message: 'TorBox API is down',
    }));

    const ruleEvaluator = {
      executeAction,
      validateTagIds: () => {},
      getTorrentStatus: () => 'queued',
      extractDownloadId: (torrent) => torrent.id,
      protectionService: {
        getProtectedSet: () => new Set(),
      },
    };

    const executor = new RuleExecutor('auth', async () => ruleEvaluator);
    const result = await executor.executeActions(
      { id: 1, name: 'Start Queued', action: { type: 'force_start' } },
      [{ id: '1' }]
    );

    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(1);
  });
});
