'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAutomationRulesStorage, useBackendMode } from '@/utils/backendDetector';
import useIsMobile from '@/hooks/useIsMobile';
import { 
  TRIGGER_TYPES, 
  CONDITION_TYPES, 
  COMPARISON_OPERATORS, 
  LOGIC_OPERATORS,
  ACTION_TYPES 
} from './constants';
import RuleCard from './components/RuleCard';
import RuleForm from './components/RuleForm';
import PresetRulesSection from './components/PresetRulesSection';
import RuleLogsModal from './components/RuleLogsModal';

// Default new rule structure
const getDefaultNewRule = () => ({
  name: '',
  enabled: true,
  trigger: {
    type: TRIGGER_TYPES.INTERVAL,
    value: 30,
  },
  conditions: [
    {
      type: CONDITION_TYPES.RATIO,
      operator: COMPARISON_OPERATORS.GT,
      value: 1,
    },
  ],
  logicOperator: LOGIC_OPERATORS.AND,
  action: {
    type: ACTION_TYPES.STOP_SEEDING,
  },
});

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
  const isMobile = useIsMobile();
  const apiKey = localStorage.getItem('torboxApiKey');
  const [newRule, setNewRule] = useState(getDefaultNewRule());

  // Backend mode indicator
  const isBackendMode = backendMode === 'backend';

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
    setNewRule(getDefaultNewRule());
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
          headers: {
            'x-api-key': apiKey,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to delete rule: ${response.status}`);
        }
      }
      
      // Update local state
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      setRules(updatedRules);
    } catch (error) {
      console.error('Error deleting rule:', error);
      // Update local state even on error
      const updatedRules = rules.filter((rule) => rule.id !== ruleId);
      setRules(updatedRules);
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
            'x-api-key': apiKey,
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
    } catch (error) {
      console.error('Error toggling rule:', error);
      // Update local state even on error
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
    }
  };

  const handleViewLogs = (ruleId) => {
    setViewingLogsRuleId(ruleId);
    loadRuleLogs(ruleId);
  };

  const loadRuleLogs = async (ruleId) => {
    try {
      if (!isBackendMode) {
        // No backend available, show empty logs
        setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
        return;
      }

      // Load logs from backend
      const response = await fetch(`/api/automation/rules/${ruleId}/logs`, {
        headers: {
          'x-api-key': apiKey,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRuleLogs(prev => ({ ...prev, [ruleId]: data.logs || [] }));
      } else {
        setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
      }
    } catch (error) {
      console.error('Error loading rule logs:', error);
      setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
    }
  };

  const clearRuleLogs = async (ruleId) => {
    try {
      setRuleLogs(prev => ({ ...prev, [ruleId]: [] }));
    } catch (error) {
      console.error('Error clearing rule logs:', error);
    }
  };

  // Helper functions for managing multiple conditions
  const addCondition = () => {
    setNewRule({
      ...newRule,
      conditions: [
        ...newRule.conditions,
        {
          type: CONDITION_TYPES.RATIO,
          operator: COMPARISON_OPERATORS.GT,
          value: 1,
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
    setNewRule((prevRule) => ({
      ...prevRule,
      conditions: prevRule.conditions.map((condition, i) =>
        i === index ? { ...condition, [field]: value } : condition,
      ),
    }));
  };

  const handleCancelForm = () => {
    setIsAddingRule(false);
    setEditingRuleId(null);
    setNewRule(getDefaultNewRule());
  };

  const activeRules = rules.filter((rule) => rule.enabled);
  const viewingRule = rules.find(r => r.id === viewingLogsRuleId);

  return (
    <div className="px-2 py-2 lg:p-4 mt-4 mb-4 border border-border dark:border-border-dark rounded-lg bg-surface dark:bg-surface-dark">
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
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={handleToggleRule}
                onEdit={handleEditRule}
                onDelete={handleDeleteRule}
                onViewLogs={handleViewLogs}
                t={t}
                commonT={commonT}
              />
            ))}

            {!isAddingRule && (
              <div className="space-y-4">
                {/* Preset Rules */}
                <PresetRulesSection
                  onApplyPreset={applyPreset}
                  t={t}
                />

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
              onAddCondition={addCondition}
              onRemoveCondition={removeCondition}
              onUpdateCondition={updateCondition}
              editingRuleId={editingRuleId}
              t={t}
              commonT={commonT}
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
        t={t}
      />
    </div>
  );
}

