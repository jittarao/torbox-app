'use client';

import { RULE_ASSET_TYPES } from '../capabilities';

export default function AssetTypesSelector({ value = ['torrent'], onChange, t }) {
  const selected = new Set(value?.length ? value : ['torrent']);

  const toggle = (type) => {
    const next = new Set(selected);
    if (next.has(type)) {
      if (next.size === 1) return;
      next.delete(type);
    } else {
      next.add(type);
    }
    onChange([...next].sort());
  };

  const labels = {
    torrent: t('assetTypes.torrent'),
    usenet: t('assetTypes.usenet'),
    webdl: t('assetTypes.webdl'),
  };

  return (
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <legend className="block text-sm font-medium text-primary-text dark:text-primary-text-dark mb-1">
        {t('assetTypes.label')}
      </legend>
      <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60 mb-2">
        {t('assetTypes.hint')}
      </p>
      <div className="flex flex-wrap gap-2">
        {RULE_ASSET_TYPES.map((type) => {
          const active = selected.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                active
                  ? 'border-accent dark:border-accent-dark bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark'
                  : 'border-border dark:border-border-dark text-primary-text/70 dark:text-primary-text-dark/70 hover:bg-surface-hover dark:hover:bg-surface-hover-dark'
              }`}
              aria-pressed={active}
            >
              {labels[type] || type}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
