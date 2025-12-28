'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { timeAgo } from '@/components/downloads/utils/formatters';
import { useAutomationRulesStorage, useBackendMode } from '@/utils/backendDetector';

const TRIGGER_TYPES = {
  INTERVAL: 'interval',
};

const CONDITION_TYPES = {
  SEEDING_TIME: 'seeding_time',
  SEEDING_RATIO: 'seeding_ratio',
  STALLED_TIME: 'stalled_time',
  SEEDS: 'seeds',
  PEERS: 'peers',
  DOWNLOAD_SPEED: 'download_speed',
  UPLOAD_SPEED: 'upload_speed',
  FILE_SIZE: 'file_size',
  AGE: 'age',
  TRACKER: 'tracker',
  INACTIVE: 'inactive',
  PROGRESS: 'progress',
  TOTAL_UPLOADED: 'total_uploaded',
  TOTAL_DOWNLOADED: 'total_downloaded',
  AVAILABILITY: 'availability',
  ETA: 'eta',
  DOWNLOAD_FINISHED: 'download_finished',
  CACHED: 'cached',
  PRIVATE: 'private',
  LONG_TERM_SEEDING: 'long_term_seeding',
  SEED_TORRENT: 'seed_torrent',
  DOWNLOAD_STATE: 'download_state',
  NAME_CONTAINS: 'name_contains',
  FILE_COUNT: 'file_count',
  EXPIRES_AT: 'expires_at',
};

const COMPARISON_OPERATORS = {
  GT: 'gt',
  LT: 'lt',
  GTE: 'gte',
  LTE: 'lte',
  EQ: 'eq',
};

const LOGIC_OPERATORS = {
  AND: 'and',
  OR: 'or',
};

const ACTION_TYPES = {
  STOP_SEEDING: 'stop_seeding',
  ARCHIVE: 'archive',
  DELETE: 'delete',
  FORCE_START: 'force_start',
};

// Preset automation rules - will be created inside component to access translations
const createPresetRules = (t) => [
  {
    name: t('presets.deleteInactive'),
    trigger: { type: 'interval', value: 30 },
    conditions: [
      { type: 'inactive', operator: 'gt', value: 0 }
    ],
    logicOperator: 'and',
    action: { type: 'delete' }
  },
  {
    name: t('presets.deleteStalled'),
    trigger: { type: 'interval', value: 30 },
    conditions: [
      { type: 'stalled_time', operator: 'gt', value: 1 }
    ],
    logicOperator: 'and',
    action: { type: 'delete' }
  },
  {
    name: t('presets.deleteQueued'),
    trigger: { type: 'interval', value: 30 },
    conditions: [
      { type: 'inactive', operator: 'gt', value: 0 },
      { type: 'age', operator: 'gt', value: 6 }
    ],
    logicOperator: 'and',
    action: { type: 'delete' }
  },
  {
    name: t('presets.stopSeedingLowRatio'),
    trigger: { type: 'interval', value: 30 },
    conditions: [
      { type: 'seeding_ratio', operator: 'gt', value: 1 },
      { type: 'seeding_time', operator: 'gt', value: 48 }
    ],
    logicOperator: 'and',
    action: { type: 'stop_seeding' }
  },
  // Availability-based rules
  {
    name: t('presets.deleteUnavailable'),
    trigger: { type: 'interval', value: 60 },
    conditions: [
      { type: 'availability', operator: 'eq', value: 0 },
      { type: 'age', operator: 'gt', value: 48 }
    ],
    logicOperator: 'and',
    action: { type: 'delete' }
  },
  // Progress-based rules
  {
    name: t('presets.deleteIncomplete'),
    trigger: { type: 'interval', value: 60 },
    conditions: [
      { type: 'progress', operator: 'lt', value: 1 },
      { type: 'age', operator: 'gt', value: 72 }
    ],
    logicOperator: 'and',
    action: { type: 'delete' }
  }
];

export default function AutomationRules() {
  const t = useTranslations('AutomationRules');
  const commonT = useTranslations('Common');
  const { mode: backendMode } = useBackendMode();
  const [rules, setRules, loading, error] = useAutomationRulesStorage();
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [viewingLogsRuleId, setViewingLogsRuleId] = useState(null);
  const [ruleLogs, setRuleLogs] = useState({});
  const [newRule, setNewRule] = useState({
    name: '',
    enabled: true,
    trigger: {
      type: TRIGGER_TYPES.INTERVAL,
      value: 30,
    },
    conditions: [
      {
        type: CONDITION_TYPES.SEEDING_RATIO,
        operator: COMPARISON_OPERATORS.GT,
        value: 1,
      },
    ],
    logicOperator: LOGIC_OPERATORS.AND,
    action: {
      type: ACTION_TYPES.STOP_SEEDING,
    },
  });

  // Apply a preset rule
  const applyPreset = async (preset) => {
    const ruleWithId = {
      ...preset,
      id: Date.now().toString(),
      enabled: true,
      metadata: {
        created_at: Date.now(),
        execution_count: 0,
        last_execution: null,
      }
    };
    
    // Update local state
    const updatedRules = [...rules, ruleWithId];
    setRules(updatedRules);
    
    // Save to backend/localStorage
    await saveRules(updatedRules);
  };

  // Backend mode indicator
  const isBackendMode = backendMode === 'backend';

  const handleAddRule = () => {
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
          : rule,
      );
      setRules(updatedRules);
      setEditingRuleId(null);
    } else {
      // Add new rule with metadata
      const now = Date.now();
      const updatedRules = [
        ...rules,
        {
          ...newRule,
          id: now,
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
      setRules(updatedRules);
    }

    setIsAddingRule(false);
    setNewRule({
      name: '',
      enabled: true,
      trigger: {
        type: TRIGGER_TYPES.INTERVAL,
        value: 5,
      },
      conditions: [
        {
          type: CONDITION_TYPES.SEEDING_TIME,
          operator: COMPARISON_OPERATORS.GT,
          value: 30,
        },
      ],
      logicOperator: LOGIC_OPERATORS.AND,
      action: {
        type: ACTION_TYPES.STOP_SEEDING,
      },
    });
  };

  const handleEditRule = (rule) => {
    setNewRule(rule);
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      if (isBackendMode) {
        // Use backend API for individual rule deletion
        const response = await fetch(`/api/automation/rules/${ruleId}`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete rule: ${response.status}`);
        }
      }
      
      // Update local state
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      setRules(updatedRules);
      
      // Also update localStorage as backup
      localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    } catch (error) {
      console.error('Error deleting rule:', error);
      // Fallback to local-only deletion
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      setRules(updatedRules);
      localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const rule = rules.find(r => r.id === ruleId);
      if (!rule) return;
      
      const newEnabled = !rule.enabled;
      
      if (isBackendMode) {
        // Use backend API for individual rule update
        const response = await fetch(`/api/automation/rules/${ruleId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: newEnabled }),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to update rule: ${response.status}`);
        }
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
      
      setRules(updatedRules);
      
      // Also update localStorage as backup
      localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    } catch (error) {
      console.error('Error toggling rule:', error);
      // Fallback to local-only update
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
      setRules(updatedRules);
      localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    }
  };

  const handleViewLogs = (ruleId) => {
    setViewingLogsRuleId(ruleId);
    loadRuleLogs(ruleId);
  };

  const loadRuleLogs = async (ruleId) => {
    try {
      if (isBackendMode) {
        // Try backend first
        const response = await fetch(`/api/automation/rules/${ruleId}/logs`);
        if (response.ok) {
          const data = await response.json();
          setRuleLogs(prev => ({ ...prev, [ruleId]: data.logs || [] }));
          return;
        }
      }
      
      // Fallback to localStorage
      const logs = localStorage.getItem(`torboxRuleLogs_${ruleId}`);
      if (logs) {
        const parsedLogs = JSON.parse(logs);
        setRuleLogs(prev => ({ ...prev, [ruleId]: parsedLogs }));
      } else {
        setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
      }
    } catch (error) {
      console.error('Error loading rule logs:', error);
      setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
    }
  };

  const clearRuleLogs = (ruleId) => {
    localStorage.removeItem(`torboxRuleLogs_${ruleId}`);
    setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
  };

  const getConditionText = (conditions, logicOperator) => {
    const operatorText = {
      [COMPARISON_OPERATORS.GT]: '>',
      [COMPARISON_OPERATORS.LT]: '<',
      [COMPARISON_OPERATORS.GTE]: '≥',
      [COMPARISON_OPERATORS.LTE]: '≤',
      [COMPARISON_OPERATORS.EQ]: '=',
    };

    const conditionTexts = conditions.map((condition) => {
      const operator = operatorText[condition.operator];

      if (condition.type === CONDITION_TYPES.SEEDING_TIME) {
        return `seeding time ${operator} ${condition.value} ${commonT('hours')}`;
      } else if (condition.type === CONDITION_TYPES.STALLED_TIME) {
        return `stalled time ${operator} ${condition.value} ${commonT('hours')}`;
      } else if (condition.type === CONDITION_TYPES.SEEDING_RATIO) {
        return `seeding ratio ${operator} ${condition.value}`;
      } else if (condition.type === CONDITION_TYPES.SEEDS) {
        return `seeds ${operator} ${condition.value}`;
      } else if (condition.type === CONDITION_TYPES.PEERS) {
        return `peers ${operator} ${condition.value}`;
      } else if (condition.type === CONDITION_TYPES.DOWNLOAD_SPEED) {
        return `download speed ${operator} ${condition.value} KB/s`;
      } else if (condition.type === CONDITION_TYPES.UPLOAD_SPEED) {
        return `upload speed ${operator} ${condition.value} KB/s`;
      } else if (condition.type === CONDITION_TYPES.FILE_SIZE) {
        return `file size ${operator} ${condition.value} GB`;
      } else if (condition.type === CONDITION_TYPES.AGE) {
        return `age ${operator} ${condition.value} ${commonT('hours')}`;
    } else if (condition.type === CONDITION_TYPES.TRACKER) {
      return `tracker ${operator} ${condition.value}`;
    } else if (condition.type === CONDITION_TYPES.INACTIVE) {
      return `inactive downloads ${operator} ${condition.value}`;
    }
      return '';
    });

    const logicText = logicOperator === LOGIC_OPERATORS.AND ? ' AND ' : ' OR ';
    return conditionTexts.join(logicText);
  };

  const activeRules = rules.filter((rule) => rule.enabled);

  // Helper functions for managing multiple conditions
  const addCondition = () => {
    setNewRule({
      ...newRule,
      conditions: [
        ...newRule.conditions,
        {
          type: CONDITION_TYPES.SEEDING_TIME,
          operator: COMPARISON_OPERATORS.GT,
          value: 30,
        },
      ],
    });
  };

  const removeCondition = (index) => {
    if (newRule.conditions.length > 1) {
      setNewRule({
        ...newRule,
        conditions: newRule.conditions.filter((_, i) => i !== index),
      });
    }
  };

  const updateCondition = (index, field, value) => {
    setNewRule({
      ...newRule,
      conditions: newRule.conditions.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition,
      ),
    });
  };

  return (
    <div className="px-2 py-2 lg:p-4 mt-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-md font-medium text-primary-text dark:text-primary-text-dark">
            {t('title')}
          </h2>
          <span className="text-xs text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 px-1.5 py-0.5 rounded-md">
            Beta
          </span>
          {isBackendMode && (
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20 px-1.5 py-0.5 rounded-md">
              24/7
            </span>
          )}
          <span className="text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            ({activeRules.length} rule{activeRules.length === 1 ? '' : 's'}{' '}
            active)
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
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 border border-border dark:border-border-dark rounded-lg"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="w-4 h-4 accent-accent dark:accent-accent-dark"
                    />
                    <span className="text-primary-text dark:text-primary-text-dark font-medium">
                      {rule.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewLogs(rule.id)}
                      className="text-blue-500 dark:text-blue-400 hover:opacity-80"
                      title={t('viewLogs')}
                    >
                      <Icons.Clock />
                    </button>
                    <button
                      onClick={() => handleEditRule(rule)}
                      className="text-accent dark:text-accent-dark hover:opacity-80"
                    >
                      <Icons.Edit />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-red-500 dark:text-red-500 hover:opacity-80"
                    >
                      <Icons.Delete />
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-primary-text/70 dark:text-primary-text-dark/70">
                  Every {rule.trigger.value} {commonT('minutes')}, if{' '}
                  {getConditionText(rule.conditions || [rule.condition], rule.logicOperator || LOGIC_OPERATORS.AND)}, then{' '}
                  {rule.action.type.replace('_', ' ')}
                  {/* {rule.metadata && (
                    <span className="ml-2">
                      {(rule.metadata.triggeredCount > 0 ||
                        rule.metadata.executionCount > 0) && (
                        <>
                          {'('}
                          {rule.metadata.triggeredCount > 0 &&
                            rule.metadata.triggeredCount + ' ' + t('triggers')}
                          {rule.metadata.executionCount > 0 &&
                            rule.metadata.executionCount +
                              ' ' +
                              t('executions')}
                          {rule.metadata.lastTriggeredAt ? (
                            <span>
                              , {t('lastTriggered')}{' '}
                              {timeAgo(rule.metadata.lastTriggeredAt, commonT)}
                            </span>
                          ) : (
                            rule.metadata.lastEnabledAt && (
                              <span>
                                , {t('enabledAt')}{' '}
                                {timeAgo(rule.metadata.lastEnabledAt, commonT)}
                              </span>
                            )
                          )}
                          {')'}
                        </>
                      )}
                    </span>
                  )} */}
                </div>
              </div>
            ))}

            {!isAddingRule && (
              <div className="space-y-4">
                {/* Preset Rules */}
                <div className="border-t border-border dark:border-border-dark pt-4">
                  <h4 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-3">
                    {t('presets.title')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {createPresetRules(t).map((preset, index) => (
                      <button
                        key={index}
                        onClick={() => applyPreset(preset)}
                        className="text-left p-3 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                      >
                        <div className="font-medium text-primary-text dark:text-primary-text-dark mb-1">
                          {preset.name}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-[10px]">
                          {preset.conditions.length === 1 
                            ? `${preset.conditions[0].type} ${preset.conditions[0].operator} ${preset.conditions[0].value}`
                            : `${preset.conditions.length} conditions`
                          } → {preset.action.type}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

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
            <div className="mt-4 p-4 border border-border dark:border-border-dark rounded-lg">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
                    {t('ruleName')}
                  </label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) =>
                      setNewRule({ ...newRule, name: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                    placeholder={t('ruleNamePlaceholder')}
                  />
                </div>

                {/* Trigger */}
                <div>
                  <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
                    {t('checkEvery')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={newRule.trigger.value}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          trigger: {
                            ...newRule.trigger,
                            value: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                      className="w-24 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                      min="1"
                    />
                    <span className="text-sm text-primary-text dark:text-primary-text-dark">
                      {commonT('minutes')}
                    </span>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark">
                      {t('conditions')}
                    </label>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="text-xs text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80"
                    >
                      + Add Condition
                    </button>
                  </div>

                  {/* Logic Operator (only show if multiple conditions) */}
                  {newRule.conditions.length > 1 && (
                    <div className="mb-3">
                      <select
                        value={newRule.logicOperator}
                        onChange={(e) =>
                          setNewRule({
                            ...newRule,
                            logicOperator: e.target.value,
                          })
                        }
                        className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark"
                      >
                        <option value={LOGIC_OPERATORS.AND} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">ALL conditions (AND)</option>
                        <option value={LOGIC_OPERATORS.OR} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">ANY condition (OR)</option>
                      </select>
                    </div>
                  )}

                  {/* Multiple Conditions */}
                  {newRule.conditions.map((condition, index) => (
                    <div key={index} className="mb-3 p-3 border border-border dark:border-border-dark rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-primary-text/70 dark:text-primary-text-dark/70">
                          Condition {index + 1}
                        </span>
                        {newRule.conditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCondition(index)}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={condition.type}
                          onChange={(e) => updateCondition(index, 'type', e.target.value)}
                          className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark"
                        >
                          <option value={CONDITION_TYPES.SEEDING_TIME} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.seedingTime')}
                          </option>
                          <option value={CONDITION_TYPES.SEEDING_RATIO} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.seedingRatio')}
                          </option>
                          <option value={CONDITION_TYPES.STALLED_TIME} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.stalledTime')}
                          </option>
                          <option value={CONDITION_TYPES.SEEDS} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.seeds')}
                          </option>
                          <option value={CONDITION_TYPES.PEERS} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.peers')}
                          </option>
                          <option value={CONDITION_TYPES.DOWNLOAD_SPEED} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.downloadSpeed')}
                          </option>
                          <option value={CONDITION_TYPES.UPLOAD_SPEED} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.uploadSpeed')}
                          </option>
                          <option value={CONDITION_TYPES.FILE_SIZE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.fileSize')}
                          </option>
                          <option value={CONDITION_TYPES.AGE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('conditions.age')}
                          </option>
                    <option value={CONDITION_TYPES.TRACKER} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('conditions.tracker')}
                    </option>
                    <option value={CONDITION_TYPES.INACTIVE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('conditions.inactive')}
                    </option>
                  </select>

                        <select
                          value={condition.operator}
                          onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                          className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark"
                        >
                          <option value={COMPARISON_OPERATORS.GT} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('operators.gt')}
                          </option>
                          <option value={COMPARISON_OPERATORS.LT} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('operators.lt')}
                          </option>
                          <option value={COMPARISON_OPERATORS.GTE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('operators.gte')}
                          </option>
                          <option value={COMPARISON_OPERATORS.LTE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('operators.lte')}
                          </option>
                          <option value={COMPARISON_OPERATORS.EQ} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                            {t('operators.eq')}
                          </option>
                        </select>

                        <input
                          type="number"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, 'value', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                          min="0"
                          step={
                            condition.type === CONDITION_TYPES.SEEDING_RATIO
                              ? '0.1'
                              : '1'
                          }
                        />
                        <span className="text-sm text-primary-text dark:text-primary-text-dark">
                    {condition.type.includes('time') || condition.type === CONDITION_TYPES.AGE
                      ? commonT('hours')
                      : condition.type === CONDITION_TYPES.SEEDS || condition.type === CONDITION_TYPES.PEERS
                      ? 'count'
                      : condition.type === CONDITION_TYPES.DOWNLOAD_SPEED || condition.type === CONDITION_TYPES.UPLOAD_SPEED
                      ? 'KB/s'
                      : condition.type === CONDITION_TYPES.FILE_SIZE
                      ? 'GB'
                      : condition.type === CONDITION_TYPES.TRACKER
                      ? 'domain'
                      : condition.type === CONDITION_TYPES.INACTIVE
                      ? 'count'
                      : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action */}
                <div>
                  <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
                    {t('action')}
                  </label>
                  <select
                    value={newRule.action.type}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        action: { type: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-surface dark:bg-surface-dark"
                  >
                    <option value={ACTION_TYPES.STOP_SEEDING} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('actions.stopSeeding')}
                    </option>
                    <option value={ACTION_TYPES.ARCHIVE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('actions.archive')}
                    </option>
                    <option value={ACTION_TYPES.DELETE} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('actions.delete')}
                    </option>
                    <option value={ACTION_TYPES.FORCE_START} className="bg-surface dark:bg-surface-dark text-primary-text dark:text-primary-text-dark">
                      {t('actions.forceStart')}
                    </option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setIsAddingRule(false);
                      setEditingRuleId(null);
                      setNewRule({
                        name: '',
                        enabled: true,
                        trigger: {
                          type: TRIGGER_TYPES.INTERVAL,
                          value: 5,
                        },
                        condition: {
                          type: CONDITION_TYPES.SEEDING_TIME,
                          operator: COMPARISON_OPERATORS.GT,
                          value: 30,
                        },
                        action: {
                          type: ACTION_TYPES.STOP_SEEDING,
                        },
                      });
                    }}
                    className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleAddRule}
                    className="px-3 py-1.5 text-sm bg-accent dark:bg-accent-dark text-white rounded-md hover:bg-accent/90 dark:hover:bg-accent-dark/90 transition-colors"
                  >
                    {editingRuleId ? t('update') : t('add')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rule Logs Modal */}
      {viewingLogsRuleId && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('ruleLogs')} - {rules.find(r => r.id === viewingLogsRuleId)?.name}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => clearRuleLogs(viewingLogsRuleId)}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                  {t('clearLogs')}
                </button>
                <button
                  onClick={() => setViewingLogsRuleId(null)}
                  className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                >
                  {t('close')}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {ruleLogs[viewingLogsRuleId]?.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('noLogs')}
                </div>
              ) : (
                <div className="space-y-3">
                  {ruleLogs[viewingLogsRuleId]?.map((log, index) => (
                    <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          log.success 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {log.success ? t('success') : t('failed')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        <div><strong>{t('action')}:</strong> {log.action}</div>
                        {log.itemsAffected > 0 && (
                          <div><strong>{t('itemsAffected')}:</strong> {log.itemsAffected}</div>
                        )}
                        {log.details && (
                          <div><strong>{t('details')}:</strong> {log.details}</div>
                        )}
                        {log.error && (
                          <div className="text-red-500 dark:text-red-400">
                            <strong>{t('error')}:</strong> {log.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
