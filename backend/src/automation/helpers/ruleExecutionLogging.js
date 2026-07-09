/**
 * Build rule execution log message from action batch results.
 * @param {{ errorCount?: number, protectedSkippedCount?: number }} result
 * @returns {string|null}
 */
export function buildRuleExecutionMessage(result = {}) {
  const parts = [];
  const errorCount = result.errorCount ?? 0;
  const protectedSkippedCount = result.protectedSkippedCount ?? 0;

  if (errorCount > 0) {
    parts.push(`${errorCount} actions failed`);
  }
  if (protectedSkippedCount > 0) {
    parts.push(`${protectedSkippedCount} action(s) skipped: download is protected`);
  }

  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * Whether an execution batch should be recorded in rule_execution_log.
 * @param {{ successCount?: number, protectedSkippedCount?: number }} result
 * @returns {boolean}
 */
export function shouldRecordRuleExecution(result = {}) {
  return (result.successCount ?? 0) > 0 || (result.protectedSkippedCount ?? 0) > 0;
}
