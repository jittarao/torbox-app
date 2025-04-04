'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';
import { timeAgo } from '@/components/downloads/utils/formatters';

const TRIGGER_TYPES = {
  INTERVAL: 'interval',
};

const CONDITION_TYPES = {
  SEEDING_TIME: 'seeding_time',
  SEEDING_RATIO: 'seeding_ratio',
  STALLED_TIME: 'stalled_time',
};

const COMPARISON_OPERATORS = {
  GT: 'gt',
  LT: 'lt',
  GTE: 'gte',
  LTE: 'lte',
  EQ: 'eq',
};

const ACTION_TYPES = {
  STOP_SEEDING: 'stop_seeding',
  ARCHIVE: 'archive',
  DELETE: 'delete',
  FORCE_START: 'force_start',
};

export default function AutomationRules() {
  const t = useTranslations('AutomationRules');
  const commonT = useTranslations('Common');
  const [rules, setRules] = useState([]);
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [newRule, setNewRule] = useState({
    name: '',
    enabled: true,
    trigger: {
      type: TRIGGER_TYPES.INTERVAL,
      value: 30,
    },
    condition: {
      type: CONDITION_TYPES.SEEDING_RATIO,
      operator: COMPARISON_OPERATORS.GT,
      value: 1,
    },
    action: {
      type: ACTION_TYPES.STOP_SEEDING,
    },
  });

  useEffect(() => {
    const savedRules = localStorage.getItem('torboxAutomationRules');
    if (savedRules) {
      setRules(JSON.parse(savedRules));
    }
  }, []);

  const saveRules = (updatedRules) => {
    localStorage.setItem('torboxAutomationRules', JSON.stringify(updatedRules));
    setRules(updatedRules);
  };

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
      saveRules(updatedRules);
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
      saveRules(updatedRules);
    }

    setIsAddingRule(false);
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
  };

  const handleEditRule = (rule) => {
    setNewRule(rule);
    setEditingRuleId(rule.id);
    setIsAddingRule(true);
  };

  const handleDeleteRule = (ruleId) => {
    const updatedRules = rules.filter((rule) => rule.id !== ruleId);
    saveRules(updatedRules);
  };

  const handleToggleRule = (ruleId) => {
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
    saveRules(updatedRules);
  };

  const getConditionText = (condition) => {
    const operatorText = {
      [COMPARISON_OPERATORS.GT]: '>',
      [COMPARISON_OPERATORS.LT]: '<',
      [COMPARISON_OPERATORS.GTE]: '≥',
      [COMPARISON_OPERATORS.LTE]: '≤',
      [COMPARISON_OPERATORS.EQ]: '=',
    };

    const operator = operatorText[condition.operator];

    if (condition.type === CONDITION_TYPES.SEEDING_TIME) {
      return `seeding time ${operator} ${condition.value} ${commonT('hours')}`;
    } else if (condition.type === CONDITION_TYPES.STALLED_TIME) {
      return `stalled time ${operator} ${condition.value} ${commonT('hours')}`;
    } else if (condition.type === CONDITION_TYPES.SEEDING_RATIO) {
      return `seeding ratio ${operator} ${condition.value}`;
    }
  };

  const activeRules = rules.filter((rule) => rule.enabled);

  return (
    <div className="mt-4 px-2 py-2 lg:p-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-primary-text dark:text-primary-text-dark">
            {t('title')}
          </h2>
          <span className="text-xs text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 px-1.5 py-0.5 rounded-md">
            Beta
          </span>
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
                  {getConditionText(rule.condition)}, then{' '}
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
              <div className="flex justify-center items-center">
                <button
                  onClick={() => setIsAddingRule(true)}
                  className="flex items-center gap-1 text-xs lg:text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
                >
                  + {t('addRule')}
                </button>
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

                {/* Condition */}
                <div>
                  <label className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
                    {t('condition')}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={newRule.condition.type}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          condition: {
                            ...newRule.condition,
                            type: e.target.value,
                          },
                        })
                      }
                      className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                    >
                      <option value={CONDITION_TYPES.SEEDING_TIME}>
                        {t('conditions.seedingTime')}
                      </option>
                      <option value={CONDITION_TYPES.SEEDING_RATIO}>
                        {t('conditions.seedingRatio')}
                      </option>
                      <option value={CONDITION_TYPES.STALLED_TIME}>
                        {t('conditions.stalledTime')}
                      </option>
                    </select>

                    <select
                      value={newRule.condition.operator}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          condition: {
                            ...newRule.condition,
                            operator: e.target.value,
                          },
                        })
                      }
                      className="px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                    >
                      <option value={COMPARISON_OPERATORS.GT}>
                        {t('operators.gt')}
                      </option>
                      <option value={COMPARISON_OPERATORS.LT}>
                        {t('operators.lt')}
                      </option>
                      <option value={COMPARISON_OPERATORS.GTE}>
                        {t('operators.gte')}
                      </option>
                      <option value={COMPARISON_OPERATORS.LTE}>
                        {t('operators.lte')}
                      </option>
                      <option value={COMPARISON_OPERATORS.EQ}>
                        {t('operators.eq')}
                      </option>
                    </select>

                    <input
                      type="number"
                      value={newRule.condition.value}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          condition: {
                            ...newRule.condition,
                            value: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-24 px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                      min="0"
                      step={
                        newRule.condition.type === CONDITION_TYPES.SEEDING_RATIO
                          ? '0.1'
                          : '1'
                      }
                    />
                    <span className="text-sm text-primary-text dark:text-primary-text-dark">
                      {newRule.condition.type.includes('time')
                        ? commonT('hours')
                        : ''}
                    </span>
                  </div>
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
                    className="w-full px-3 py-1.5 text-sm text-primary-text dark:text-primary-text-dark border border-border dark:border-border-dark rounded-md bg-transparent"
                  >
                    <option value={ACTION_TYPES.STOP_SEEDING}>
                      {t('actions.stopSeeding')}
                    </option>
                    <option value={ACTION_TYPES.ARCHIVE}>
                      {t('actions.archive')}
                    </option>
                    <option value={ACTION_TYPES.DELETE}>
                      {t('actions.delete')}
                    </option>
                    <option value={ACTION_TYPES.FORCE_START}>
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
    </div>
  );
}
