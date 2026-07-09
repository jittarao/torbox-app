import { describe, expect, test } from 'bun:test';
import {
  buildRuleExecutionMessage,
  shouldRecordRuleExecution,
} from '../helpers/ruleExecutionLogging.js';

describe('ruleExecutionLogging', () => {
  test('buildRuleExecutionMessage includes protected skip text', () => {
    expect(buildRuleExecutionMessage({ errorCount: 0, protectedSkippedCount: 2 })).toBe(
      '2 action(s) skipped: download is protected'
    );
  });

  test('shouldRecordRuleExecution when only protected skips occurred', () => {
    expect(shouldRecordRuleExecution({ successCount: 0, protectedSkippedCount: 1 })).toBe(true);
  });
});
