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
});
