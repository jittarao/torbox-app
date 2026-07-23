'use client';

import Spinner from '@/components/shared/Spinner';
import RuleCard from './components/RuleCard';
import RuleForm from './components/RuleForm';
import PresetRulesSection from './components/PresetRulesSection';
import EmptyState from './components/EmptyState';
import RuleLogsModal from './components/RuleLogsModal';
import ExecutionResult from './components/ExecutionResult';
import { useAutomationRulesPage } from './useAutomationRulesPage';

export default function AutomationRules({ apiKey: apiKeyProp = '' }) {
  const {
    t,
    commonT,
    isBackendMode,
    isAddingRule,
    setIsAddingRule,
    editingRuleId,
    viewingLogsRuleId,
    setViewingLogsRuleId,
    ruleLogs,
    runningRuleId,
    executionResult,
    setExecutionResult,
    apiKey,
    newRule,
    rules,
    loading,
    applyPreset,
    handleAddRule,
    handleRuleChange,
    handleEditRule,
    handleDeleteRule,
    handleToggleRule,
    handleViewLogs,
    clearRuleLogs,
    handleRunRule,
    handleAddGroup,
    handleRemoveGroup,
    handleUpdateGroup,
    handleAddCondition,
    handleRemoveCondition,
    handleUpdateCondition,
    handleCancelForm,
    activeRules,
    viewingRule,
  } = useAutomationRulesPage(apiKeyProp);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-md lg:text-xl font-medium text-primary-text dark:text-primary-text-dark">
            {t('title')}
          </h1>
          <span className="text-xs text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 px-1.5 py-0.5 rounded-md">
            Beta
          </span>
          {isBackendMode && (
            <span className="text-xs text-label-success-text dark:text-label-success-text-dark bg-label-success-bg dark:bg-label-success-bg-dark px-1.5 py-0.5 rounded-md">
              24/7
            </span>
          )}
          <span className="text-xs md:text-sm text-primary-text/70 dark:text-primary-text-dark/70">
            ({activeRules.length} rule{activeRules.length === 1 ? '' : 's'} active)
          </span>
        </div>
        {!isAddingRule && rules.length > 0 && (
          <button
            type="button"
            onClick={() => setIsAddingRule(true)}
            className="shrink-0 inline-flex items-center gap-1 text-sm text-accent dark:text-accent-dark hover:text-accent/80 dark:hover:text-accent-dark/80 transition-colors"
          >
            + {t('addRule')}
          </button>
        )}
      </div>

      <ExecutionResult
        executionResult={executionResult}
        t={t}
        onClose={() => setExecutionResult(null)}
      />

      {loading && rules.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" className="text-primary-text dark:text-primary-text-dark" />
        </div>
      ) : isAddingRule ? (
        <RuleForm
          rule={newRule}
          onRuleChange={handleRuleChange}
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
      ) : rules.length === 0 ? (
        <EmptyState
          isBackendMode={isBackendMode}
          onCreateRule={() => setIsAddingRule(true)}
          onApplyPreset={applyPreset}
          presetT={t}
        />
      ) : (
        <div className="space-y-4">
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
          <PresetRulesSection onApplyPreset={applyPreset} t={t} />
        </div>
      )}

      <RuleLogsModal
        ruleId={viewingLogsRuleId}
        ruleName={viewingRule?.name}
        logs={ruleLogs[viewingLogsRuleId]}
        onClose={() => setViewingLogsRuleId(null)}
        onClearLogs={clearRuleLogs}
        lastEvaluatedAt={viewingRule?.last_evaluated_at}
        t={t}
        commonT={commonT}
      />
    </div>
  );
}
