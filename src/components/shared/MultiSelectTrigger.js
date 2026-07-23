export default function MultiSelectTrigger({
  selectRef,
  disabled,
  className,
  isOpen,
  selectedOptions,
  displayText,
  onToggle,
  onRemoveOption,
}) {
  return (
    <button
      ref={selectRef}
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`
          flex items-center justify-between w-full px-3 py-1.5 text-sm
          text-primary-text dark:text-primary-text-dark
          border border-border dark:border-border-dark rounded-md
          bg-surface dark:bg-surface-dark
          hover:border-accent/50 dark:hover:border-accent-dark/50
          focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
          touch-manipulation
          ${className}
        `}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {selectedOptions.length > 0 && selectedOptions.length <= 2 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark"
              >
                {opt.label}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => onRemoveOption(opt.value, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRemoveOption(opt.value, e);
                    }
                  }}
                  className="hover:text-accent/80 dark:hover:text-accent-dark/80 focus:outline-none cursor-pointer"
                  aria-label={`Remove ${opt.label}`}
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="truncate">{displayText}</span>
        )}
      </div>
      <svg
        className={`size-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
