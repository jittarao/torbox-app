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
  const showChips = selectedOptions.length > 0 && selectedOptions.length <= 2;

  return (
    <div
      ref={selectRef}
      tabIndex={-1}
      className={`
          flex items-center justify-between w-full px-3 py-1.5 text-sm
          text-primary-text dark:text-primary-text-dark
          border border-border dark:border-border-dark rounded-md
          bg-surface dark:bg-surface-dark
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showChips ? (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark"
              >
                {opt.label}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(e) => onRemoveOption(opt.value, e)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="hover:text-accent/80 dark:hover:text-accent-dark/80 focus:outline-none focus:ring-1 focus:ring-accent dark:focus:ring-accent-dark rounded-sm cursor-pointer disabled:cursor-not-allowed"
                  aria-label={`Remove ${opt.label}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            className="truncate text-left flex-1 min-w-0 bg-transparent border-0 p-0 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset rounded-sm disabled:cursor-not-allowed touch-manipulation"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            {displayText}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="ml-2 flex-shrink-0 rounded-sm focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset touch-manipulation disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={showChips ? displayText : undefined}
      >
        <svg
          className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
