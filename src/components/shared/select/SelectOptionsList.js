export default function SelectOptionsList({
  options,
  optgroups,
  value,
  onSelect,
  optionsRef,
  emptyMessage = 'No matches',
}) {
  const items = [];
  let optionIndex = 0;

  options.forEach((opt, idx) => {
    const isSelected = String(opt.value) === String(value);
    items.push(
      <button
        key={`opt-standalone-${idx}-${opt.value}`}
        ref={(el) => {
          if (el) optionsRef.current[optionIndex] = el;
        }}
        type="button"
        data-value={opt.value}
        onClick={() => onSelect(opt.value)}
        title={opt.title || undefined}
        className={`block w-full text-left px-4 py-2 text-sm transition-colors
          ${
            isSelected
              ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
              : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
          }
          focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
          touch-manipulation`}
      >
        {opt.label}
      </button>
    );
    optionIndex++;
  });

  optgroups.forEach((group, groupIdx) => {
    items.push(
      <div key={`group-${groupIdx}-${group.label}`} className="sticky top-0 z-10">
        <div className="px-3 py-1.5 text-xs font-semibold text-primary-text/60 dark:text-primary-text-dark/60 bg-surface/50 dark:bg-surface-dark/50 border-b border-border dark:border-border-dark">
          {group.label}
        </div>
      </div>
    );

    group.options.forEach((opt, optIdx) => {
      const isSelected = String(opt.value) === String(value);
      items.push(
        <button
          key={`opt-group-${groupIdx}-${optIdx}-${opt.value}`}
          ref={(el) => {
            if (el) optionsRef.current[optionIndex] = el;
          }}
          type="button"
          data-value={opt.value}
          onClick={() => onSelect(opt.value)}
          title={opt.title || undefined}
          className={`block w-full text-left px-4 py-2 pl-6 text-sm transition-colors
            ${
              isSelected
                ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
                : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
            }
            focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
            touch-manipulation`}
        >
          {opt.label}
        </button>
      );
      optionIndex++;
    });
  });

  if (items.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-primary-text/60 dark:text-primary-text-dark/60">
        {emptyMessage}
      </div>
    );
  }

  return items;
}
