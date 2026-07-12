'use client';

import { useState } from 'react';
import { ChevronDown } from '@/components/icons';
import { createViewPresets } from '../presets';

export default function PresetViewsSection({ onApplyPreset, onSavePreset, isSaving = false, t }) {
  const [expanded, setExpanded] = useState(false);
  const presets = createViewPresets(t);

  const handleApply = (preset) => {
    onApplyPreset(preset);
    setExpanded(false);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-surface-alt/20 dark:border-border-dark/50 dark:bg-surface-alt-dark/15">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-alt/50 dark:hover:bg-surface-alt-dark/30"
      >
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-primary-text dark:text-primary-text-dark">
            {t('presets.title')}
          </span>
          <span className="mt-0.5 block truncate text-[10px] text-primary-text/55 dark:text-primary-text-dark/55">
            {expanded ? t('presets.applyHint') : t('presets.collapsedHint')}
          </span>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-primary-text/45 transition-transform dark:text-primary-text-dark/45 ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-2 pb-2 pt-1.5 dark:border-border-dark/40">
          <div
            className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto overscroll-contain sm:max-h-44 sm:grid-cols-3"
            role="list"
          >
            {presets.map((preset) => (
              <div
                key={preset.id}
                role="listitem"
                title={preset.description}
                className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-border/60 bg-surface-alt/60 dark:border-border-dark/60 dark:bg-surface-alt-dark/50"
              >
                <button
                  type="button"
                  onClick={() => handleApply(preset)}
                  disabled={isSaving}
                  aria-label={t('presets.applyPreset', { name: preset.name })}
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[11px] font-medium text-primary-text transition-colors hover:bg-surface-alt-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-text-dark dark:hover:bg-surface-alt-hover-dark"
                >
                  {preset.name}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSavePreset(preset);
                  }}
                  disabled={isSaving}
                  aria-label={t('presets.saveAsView', { name: preset.name })}
                  aria-busy={isSaving}
                  className="shrink-0 border-l border-border/60 px-2 text-[10px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark/60 dark:text-accent-dark dark:hover:bg-accent-dark/10"
                >
                  {t('presets.save')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
