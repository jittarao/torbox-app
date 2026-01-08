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
        {presets.map((preset, index) => (
          <button
            key={index}
            onClick={() => onApplyPreset(preset)}
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
  );
}

