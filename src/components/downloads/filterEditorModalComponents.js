function SaveOptionToggle({ checked, disabled, onChange, label, hint }) {
  return (
    <label
      className={`flex min-w-0 flex-1 basis-[calc(50%-0.25rem)] cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2 transition-colors sm:min-w-[7.5rem] sm:basis-auto ${
        disabled
          ? 'cursor-not-allowed border-border/40 opacity-50 dark:border-border-dark/40'
          : checked
            ? 'border-accent/40 bg-accent/10 dark:border-accent-dark/40 dark:bg-accent-dark/10'
            : 'border-border/60 bg-surface-alt/40 hover:border-border dark:border-border-dark/60 dark:bg-surface-alt-dark/30 dark:hover:border-border-dark'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="size-3.5 rounded border-border text-accent focus:ring-accent/30 dark:border-border-dark dark:text-accent-dark"
        />
        <span className="text-xs font-medium text-primary-text dark:text-primary-text-dark">
          {label}
        </span>
      </span>
      {hint && (
        <span className="pl-5 text-[10px] leading-snug text-primary-text/50 dark:text-primary-text-dark/50 truncate">
          {hint}
        </span>
      )}
    </label>
  );
}

export function SaveAsNewForm({
  saveViewName,
  setSaveViewName,
  onSave,
  onCancel,
  isSaving,
  customViewsT,
  className = '',
}) {
  return (
    <form
      className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <input
        type="text"
        value={saveViewName}
        onChange={(e) => setSaveViewName(e.target.value)}
        placeholder={customViewsT('viewNamePlaceholder')}
        className="min-w-0 flex-1 rounded-xl border border-border/80 bg-surface px-3 py-2 text-sm focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/15 dark:border-border-dark/80 dark:bg-surface-dark dark:focus:ring-accent-dark/15"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onCancel();
          }
        }}
        autoFocus
      />
      <div className="flex flex-col gap-2 shrink-0 sm:flex-row">
        <button
          type="submit"
          disabled={isSaving || !saveViewName.trim()}
          className="ui-btn-accent w-full !py-2 !text-xs sm:w-auto"
        >
          {isSaving ? customViewsT('saving') : customViewsT('save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="ui-btn-ghost w-full !py-2 !text-xs sm:w-auto"
        >
          {customViewsT('cancel')}
        </button>
      </div>
    </form>
  );
}

export function SaveOptionsPanel({
  saveSort,
  setSaveSort,
  saveColumns,
  setSaveColumns,
  saveSearch,
  setSaveSearch,
  trimmedSearch,
  t,
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-surface-alt/25 p-3 dark:border-border-dark/50 dark:bg-surface-alt-dark/20">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary-text/45 dark:text-primary-text-dark/45">
        {t('viewEditorSaveOptions')}
      </p>
      <div className="flex flex-wrap gap-2">
        <SaveOptionToggle
          checked={saveSort}
          onChange={(e) => setSaveSort(e.target.checked)}
          label={t('includeSort')}
        />
        <SaveOptionToggle
          checked={saveColumns}
          onChange={(e) => setSaveColumns(e.target.checked)}
          label={t('includeColumns')}
        />
        <SaveOptionToggle
          checked={saveSearch}
          disabled={!trimmedSearch}
          onChange={(e) => setSaveSearch(e.target.checked)}
          label={t('includeSearch')}
          hint={
            saveSearch && trimmedSearch
              ? t('includeSearchHint', { query: trimmedSearch })
              : undefined
          }
        />
      </div>
    </div>
  );
}
