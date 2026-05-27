'use client';

import { createPresetRules } from '../presets';

export default function PresetRulesSection({ onApplyPreset, t }) {
  const presets = createPresetRules(t);

  return (
    <div className="border-t border-border dark:border-border-dark pt-4">
      <h4 className="text-sm font-medium text-primary-text dark:text-primary-text-dark mb-3">
        {t('presets.title')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            type="button"
            key={preset.name}
            onClick={() => onApplyPreset(preset)}
            className="text-left p-3 text-xs bg-surface-alt dark:bg-surface-alt-dark hover:bg-surface-alt-hover dark:hover:bg-surface-alt-hover-dark rounded-lg transition-colors border border-border dark:border-border-dark"
          >
            <div className="font-medium text-primary-text dark:text-primary-text-dark mb-1">
              {preset.name}
            </div>
            <div className="text-primary-text/70 dark:text-primary-text-dark/70 text-[10px]">
              {(() => {
                const conditions = (preset.groups || []).flatMap((group) => group.conditions || []);
                return conditions.length === 1
                  ? `${conditions[0].type} ${conditions[0].operator} ${conditions[0].value}`
                  : `${conditions.length} conditions`;
              })()}{' '}
              → {preset.action.type}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
