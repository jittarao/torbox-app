'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAutomationRules } from '@/components/shared/hooks/useAutomationRules';
import { useBackendMode } from '@/hooks/useBackendMode';
import useIsMobile from '@/hooks/useIsMobile';
import {
  TRIGGER_TYPES,
  CONDITION_TYPES,
  COMPARISON_OPERATORS,
  LOGIC_OPERATORS,
  ACTION_TYPES,
} from './constants';
import RuleCard from './components/RuleCard';
import RuleForm from './components/RuleForm';
import PresetRulesSection from './components/PresetRulesSection';
import RuleLogsModal from './components/RuleLogsModal';

// Default new rule structure (using groups)
const getDefaultNewRule = () => ({
  name: '',
  enabled: true,
  trigger: {
    type: TRIGGER_TYPES.INTERVAL,
    value: 30,
  },
  logicOperator: LOGIC_OPERATORS.AND,
  groups: [
    {
      logicOperator: LOGIC_OPERATORS.AND,
      conditions: [
        {
          type: CONDITION_TYPES.RATIO,
          operator: COMPARISON_OPERATORS.GT,
          value: 1,
        },
      ],
    },
  ],
  action: {
    type: ACTION_TYPES.STOP_SEEDING,
  },
});

export default function AutomationRules() {
  const t = useTranslations('AutomationRules');
  const commonT = useTranslations('Common');
  const { mode: backendMode } = useBackendMode();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [viewingLogsRuleId, setViewingLogsRuleId] = useState(null);
  const [ruleLogs, setRuleLogs] = useState({});
  const [runningRuleId, setRunningRuleId] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const isMobile = useIsMobile();
  const apiKey = localStorage.getItem('torboxApiKey');
  const [newRule, setNewRule] = useState(getDefaultNewRule());
  const { rules, saveRules } = useAutomationRules(apiKey);

  // Backend mode indicator
  const isBackendMode = backendMode === 'backend';

  // Apply a preset rule
  const applyPreset = async (preset) => {
    const ruleWithoutId = {
      ...preset,
      enabled: true,
      metadata: {
        created_at: Date.now(),
        execution_count: 0,
        last_execution: null,
      },
    };

    // Update state via store (backend will assign ID)
    const updatedRules = [...rules, ruleWithoutId];
    await saveRules(updatedRules);
  };

  const handleAddRule = async () => {
    if (!newRule.name) return;

    if (editingRuleId) {
      // Update existing rule
      const updatedRules = rules.map((rule) =>
        rule.id === editingRuleId
          ? {
              ...newRule,
              id: editingRuleId,
              metadata: {
                ...rule.metadata,
                updatedAt: Date.now(),
              },
            }
          : rule
      );
      await saveRules(updatedRules);
      setEditingRuleId(null);
    } else {
      // Add new rule with metadata (backend will assign ID)
      const now = Date.now();
      const updatedRules = [
        ...rules,
        {
          ...newRule,
          metadata: {
            executionCount: 0,
            lastExecutedAt: null,
            triggeredCount: 0,
            lastTriggeredAt: null,
            lastEnabledAt: now,
            createdAt: now,
            updatedAt: now,
          },
        },
      ];
      await saveRules(updatedRules);
    }

    setIsAddingRule(false);
    setNewRule(getDefaultNewRule());
  };

  const handleEditRule = async (rule) => {
    // Rules from backend are always in group structure
    setNewRule(rule);
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      if (isBackendMode) {
        // Validate and convert ruleId to a positive integer
        // Backend expects a positive integer ID
        const numericId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : ruleId;
        if (numericId && !isNaN(numericId) && numericId > 0) {
          // Use backend API for individual rule deletion
          const response = await fetch(`/api/automation/rules/${numericId}`, {
            method: 'DELETE',
            headers: {
              'x-api-key': apiKey,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to delete rule: ${response.status}`);
          }
        }
        // If ID is invalid, skip API call (likely a local-only rule)
      }

      // Update state via store
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      await saveRules(updatedRules);
    } catch (error) {
      console.error('Error deleting rule:', error);
      // Update state even on error
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      await saveRules(updatedRules);
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const rule = rules.find((r) => r.id === ruleId);
      if (!rule) return;

      const newEnabled = !rule.enabled;

      if (isBackendMode) {
        // Validate and convert ruleId to a positive integer
        // Backend expects a positive integer ID
        const numericId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : ruleId;
        if (numericId && !isNaN(numericId) && numericId > 0) {
          // Use backend API for individual rule update
          const response = await fetch(`/api/automation/rules/${numericId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({ enabled: newEnabled }),
          });

          if (!response.ok) {
            throw new Error(`Failed to update rule: ${response.status}`);
          }
        }
        // If ID is invalid, skip API call (likely a local-only rule)
      }

      // Update local state
      const updatedRules = rules.map((rule) => {
        if (rule.id === ruleId) {
          const now = Date.now();
          return {
            ...rule,
            enabled: newEnabled,
            metadata: {
              ...rule.metadata,
              lastEnabledAt: rule.enabled ? null : now,
              updatedAt: now,
            },
          };
        }
        return rule;
      });

      await saveRules(updatedRules);
    } catch (error) {
      console.error('Error toggling rule:', error);
      // Update state even on error
      const updatedRules = rules.map((rule) => {
        if (rule.id === ruleId) {
          const now = Date.now();
          return {
            ...rule,
            enabled: !rule.enabled,
            metadata: {
              ...rule.metadata,
              lastEnabledAt: rule.enabled ? null : now,
              updatedAt: now,
            },
          };
        }
        return rule;
      });
      await saveRules(updatedRules);
    }
  };

  const handleViewLogs = async (ruleId) => {
    setViewingLogsRuleId(ruleId);
    loadRuleLogs(ruleId);
  };

  const loadRuleLogs = async (ruleId) => {
    try {
      if (!isBackendMode) {
        // No backend available, show empty logs
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Validate and convert ruleId to a positive integer
      // Backend expects a positive integer ID
      if (ruleId === null || ruleId === undefined || ruleId === '') {
        // Invalid ID - likely a local-only rule, skip API call
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Convert to number if it's a string, otherwise use as-is
      const numericId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : Number(ruleId);

      // Validate it's a positive integer
      if (isNaN(numericId) || !Number.isInteger(numericId) || numericId <= 0) {
        // Invalid ID - likely a local-only rule, skip API call
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Load logs from backend
      const response = await fetch(`/api/automation/rules/${numericId}/logs`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Find the rule to get its action type
        const rule = rules.find((r) => r.id === ruleId || r.id === numericId);
        const ruleActionType = rule?.action?.type;

        // Transform backend log format to frontend format
        const transformedLogs = (data.logs || []).map((log) => {
          return {
            timestamp: log.executed_at, // Backend uses executed_at
            action: ruleActionType || log.execution_type || 'execution', // Pass action type for translation
            actionType: ruleActionType, // Keep original action type for translation
            itemsAffected: log.items_processed || 0, // Backend uses items_processed
            success: log.success === 1 || log.success === true, // Convert 1/0 to boolean
            error: log.error_message || null, // Backend uses error_message
            details: log.items_processed > 0 ? `${log.items_processed} items processed` : null,
          };
        });
        setRuleLogs((prev) => ({ ...prev, [ruleId]: transformedLogs }));
      } else {
        const errorData = await response.json().catch(() => ({}));
        // Only log error if it's not the expected "invalid id" error for local rules
        if (!errorData.error || !errorData.error.includes('Invalid id')) {
          console.error('Error loading rule logs:', errorData.error || `HTTP ${response.status}`);
        }
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
      }
    } catch (error) {
      console.error('Error loading rule logs:', error);
      setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
    }
  };

  const clearRuleLogs = async (ruleId) => {
    try {
      if (!isBackendMode) {
        // No backend available, just clear local state
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Validate and convert ruleId to a positive integer
      // Backend expects a positive integer ID
      const numericId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : ruleId;
      if (!numericId || isNaN(numericId) || numericId <= 0) {
        // Invalid ID - likely a local-only rule, just clear local state
        setRuleLogs((prev) => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Clear logs in backend
      const response = await fetch(`/api/automation/rules/${numericId}/logs`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (response.ok) {
        // Reload logs to ensure UI is in sync (should be empty now)
        await loadRuleLogs(ruleId);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to clear logs: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error clearing rule logs:', error);
      // Optionally show error to user - for now just log it
      // The logs will remain in local state if backend call fails
    }
  };

  const handleRunRule = async (ruleId) => {
    if (runningRuleId === ruleId) {
      // Already running, prevent duplicate execution
      return;
    }

    try {
      setRunningRuleId(ruleId);

      if (!isBackendMode) {
        console.warn(
          '[Automation Rule Execution] Backend is not available. Rule execution requires backend mode.'
        );
        return;
      }

      // Validate and convert ruleId to a positive integer
      const numericId = typeof ruleId === 'string' ? parseInt(ruleId, 10) : ruleId;
      if (!numericId || isNaN(numericId) || numericId <= 0) {
        console.warn('[Automation Rule Execution] Invalid rule ID:', ruleId);
        return;
      }

      const rule = rules.find((r) => r.id === ruleId);
      const ruleName = rule?.name || 'Unknown Rule';

      console.log(
        `[Automation Rule Execution] Starting execution for rule: "${ruleName}" (ID: ${ruleId})`
      );

      const startTime = Date.now();
      const response = await fetch(`/api/automation/rules/${numericId}/run`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
        },
      });

      const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}`;
        console.error(`[Automation Rule Execution] Rule: "${ruleName}" (ID: ${ruleId})`);
        console.error(`  - Status: ❌ Failed`);
        console.error(`  - Error: ${errorMessage}`);
        console.error(`  - Execution time: ${executionTime}s`);
        return;
      }

      const data = await response.json();
      const result = data.result || {};

      // Format console output
      console.group(
        `[Automation Rule Execution] Rule: "${result.ruleName || ruleName}" (ID: ${result.ruleId || ruleId})`
      );
      console.log(`  - Torrents evaluated: ${result.totalTorrents || 0}`);
      console.log(`  - Torrents matched: ${result.matchedTorrents || 0}`);
      console.log(`  - Torrents processed: ${result.processedTorrents || 0}`);
      console.log(`  - Actions succeeded: ${result.successCount || 0}`);
      console.log(`  - Actions failed: ${result.errorCount || 0}`);
      console.log(`  - Execution time: ${result.executionTime || executionTime}s`);

      if (result.error) {
        console.error(`  - Error: ${result.error}`);
        console.log(`  - Status: ❌ Error`);
      } else if (result.skipped) {
        console.log(`  - Reason: ${result.reason || 'Rule was skipped'}`);
        console.log(`  - Status: ⏭️ Skipped`);
      } else if (result.executed) {
        const status = result.errorCount > 0 ? '⚠️ Partial Success' : '✅ Success';
        console.log(`  - Status: ${status}`);
      } else {
        console.log(`  - Status: ⏭️ Not Executed`);
      }
      console.groupEnd();

      // Store execution result for display
      setExecutionResult({
        ruleName: result.ruleName || ruleName,
        matchedTorrents: result.matchedTorrents || 0,
        successCount: result.successCount || 0,
        errorCount: result.errorCount || 0,
        skipped: result.skipped || false,
        executed: result.executed || false,
        rateLimited: result.rateLimited || false,
        reason: result.reason || null,
      });
    } catch (error) {
      console.error('[Automation Rule Execution] Error running rule:', error);
      const rule = rules.find((r) => r.id === ruleId);
      const ruleName = rule?.name || 'Unknown Rule';
      console.error(`  - Rule: "${ruleName}" (ID: ${ruleId})`);
      console.error(`  - Error: ${error.message}`);
    } finally {
      setRunningRuleId(null);
    }
  };

  // Helper functions for managing groups and conditions
  const handleAddGroup = () => {
    setNewRule((prevRule) => {
      return {
        ...prevRule,
        groups: [
          ...(prevRule.groups || []),
          {
            logicOperator: LOGIC_OPERATORS.AND,
            conditions: [],
          },
        ],
      };
    });
  };

  const handleRemoveGroup = (groupIndex) => {
    setNewRule((prevRule) => {
      const newGroups = (prevRule.groups || []).filter((_, i) => i !== groupIndex);
      if (newGroups.length === 0) {
        // Ensure at least one group exists
        return {
          ...prevRule,
          groups: [
            {
              logicOperator: LOGIC_OPERATORS.AND,
              conditions: [],
            },
          ],
        };
      }
      return {
        ...prevRule,
        groups: newGroups,
      };
    });
  };

  const handleUpdateGroup = (groupIndex, field, value) => {
    setNewRule((prevRule) => {
      const newGroups = [...(prevRule.groups || [])];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        [field]: value,
      };
      return {
        ...prevRule,
        groups: newGroups,
      };
    });
  };

  const handleAddCondition = (groupIndex) => {
    setNewRule((prevRule) => {
      const newGroups = [...(prevRule.groups || [])];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        conditions: [
          ...(newGroups[groupIndex].conditions || []),
          {
            type: CONDITION_TYPES.RATIO,
            operator: COMPARISON_OPERATORS.GT,
            value: 1,
          },
        ],
      };
      return {
        ...prevRule,
        groups: newGroups,
      };
    });
  };

  const handleRemoveCondition = (groupIndex, conditionIndex) => {
    setNewRule((prevRule) => {
      const newGroups = [...(prevRule.groups || [])];
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        conditions: (newGroups[groupIndex].conditions || []).filter((_, i) => i !== conditionIndex),
      };
      return {
        ...prevRule,
        groups: newGroups,
      };
    });
  };

  const handleUpdateCondition = (groupIndex, conditionIndex, field, value) => {
    setNewRule((prevRule) => {
      const newGroups = [...(prevRule.groups || [])];
      const newConditions = [...(newGroups[groupIndex].conditions || [])];
      newConditions[conditionIndex] = {
        ...newConditions[conditionIndex],
        [field]: value,
      };
      newGroups[groupIndex] = {
        ...newGroups[groupIndex],
        conditions: newConditions,
      };
      return {
        ...prevRule,
        groups: newGroups,
      };
    });
  };

  const handleCancelForm = () => {
    setIsAddingRule(false);
    setEditingRuleId(null);
    setNewRule(getDefaultNewRule());
  };

  const activeRules = rules.filter((rule) => rule.enabled);
  const viewingRule = rules.find((r) => r.id === viewingLogsRuleId);

  return (
    <div className="px-2 py-2 lg:p-4 mt-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      {/* Execution Result Info Box */}
      {executionResult && (
        <div
          className={`mb-4 p-4 border rounded-lg ${
            executionResult.rateLimited
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className={`w-5 h-5 ${
                    executionResult.rateLimited
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-blue-600 dark:text-blue-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {executionResult.rateLimited ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  )}
                </svg>
                <h4
                  className={`font-semibold ${
                    executionResult.rateLimited
                      ? 'text-yellow-900 dark:text-yellow-100'
                      : 'text-blue-900 dark:text-blue-100'
                  }`}
                >
                  {executionResult.rateLimited
                    ? t('ruleRateLimited') || 'Rule Rate Limited'
                    : t('ruleExecuted') || 'Rule Executed'}
                </h4>
              </div>
              <div
                className={`text-sm space-y-1 ${
                  executionResult.rateLimited
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}
              >
                {executionResult.rateLimited ? (
                  <p>{executionResult.reason || t('ruleRateLimitedDescription')}</p>
                ) : executionResult.skipped && executionResult.successCount === 0 ? (
                  <>
                    <p>
                      <strong>{executionResult.matchedTorrents}</strong>{' '}
                      {executionResult.matchedTorrents === 1
                        ? t('torrentMatched') || 'torrent matched'
                        : t('torrentsMatched') || 'torrents matched'}
                      .
                    </p>
                    <p>
                      <strong>0</strong> {t('actionsPerformed') || 'actions performed'} (
                      {t('actionAlreadyApplied') || 'action already applied or not applicable'}).
                    </p>
                  </>
                ) : executionResult.executed ? (
                  <>
                    <p>
                      <strong>{executionResult.matchedTorrents}</strong>{' '}
                      {executionResult.matchedTorrents === 1
                        ? t('torrentMatched') || 'torrent matched'
                        : t('torrentsMatched') || 'torrents matched'}
                      .
                    </p>
                    <p>
                      <strong>{executionResult.successCount}</strong>{' '}
                      {executionResult.successCount === 1
                        ? t('actionPerformed') || 'action performed'
                        : t('actionsPerformed') || 'actions performed'}
                      {executionResult.errorCount > 0 && (
                        <>
                          {' '}
                          ({executionResult.errorCount}{' '}
                          {executionResult.errorCount === 1
                            ? t('actionFailed') || 'action failed'
                            : t('actionsFailed') || 'actions failed'}
                          )
                        </>
                      )}
                      .
                    </p>
                  </>
                ) : (
                  <p>
                    {t('ruleEvaluatedNoActions') ||
                      'Rule was evaluated but no actions were performed.'}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setExecutionResult(null)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
              aria-label={t('close') || 'Close'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-md font-medium text-primary-text dark:text-primary-text-dark">
            {isMobile ? t('mobileTitle') : t('title')}
          </h3>
          <span className="text-xs text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 px-1.5 py-0.5 rounded-md">
            Beta
          </span>
          {isBackendMode && (
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">
              24/7
            </span>
          )}
          <span className="text-xs md:text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            ({activeRules.length} rule{activeRules.length === 1 ? '' : 's'} active)
          </span>
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
          >
            {isExpanded ? t('section.hide') : t('section.show')}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4">
          {/* Rules List */}
          <div className="space-y-4">
            {rules.length === 0 && (
              <div className="text-center text-primary-text/70 dark:text-primary-text-dark/70 py-8">
                {t('noRules')}
              </div>
            )}
            {rules.map((rule, index) => (
              <RuleCard
                key={rule.id || `temp-${index}`}
                rule={rule}
                onToggle={handleToggleRule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onViewLogs={handleViewLogs}
                onRun={handleRunRule}
                isRunning={runningRuleId === rule.id}
                t={t}
                commonT={commonT}
              />
            ))}

            {!isAddingRule && (
              <div className="space-y-4">
                {/* Preset Rules */}
                <PresetRulesSection onApplyPreset={applyPreset} t={t} />

                {/* Add Custom Rule */}
                <div className="flex justify-center items-center">
                  <button
                    onClick={() => setIsAddingRule(true)}
                    className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
                  >
                    + {t('addRule')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add/Edit Rule Form */}
          {isAddingRule && (
            <RuleForm
              rule={newRule}
              onRuleChange={setNewRule}
              onSubmit={handleAddRule}
              onCancel={handleCancelForm}
              onAddGroup={handleAddGroup}
              onRemoveGroup={handleRemoveGroup}
              onUpdateGroup={handleUpdateGroup}
              onAddCondition={handleAddCondition}
              onRemoveCondition={handleRemoveCondition}
              onUpdateCondition={handleUpdateCondition}
              editingRuleId={editingRuleId}
              t={t}
              commonT={commonT}
              apiKey={apiKey}
            />
          )}
        </div>
      )}

      {/* Rule Logs Modal */}
      <RuleLogsModal
        ruleId={viewingLogsRuleId}
        ruleName={viewingRule?.name}
        logs={ruleLogs[viewingLogsRuleId]}
        onClose={() => setViewingLogsRuleId(null)}
        onClearLogs={clearRuleLogs}
        lastEvaluatedAt={viewingRule?.last_evaluated_at}
        t={t}
      />
    </div>
  );
}
