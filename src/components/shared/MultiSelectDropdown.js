export default function MultiSelectDropdown({
  dropdownRef,
  dropdownLayout,
  searchable,
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
  searchPlaceholder,
  filteredOptions,
  options,
  selectedValueSet,
  onToggleOption,
  optionsRef,
}) {
  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-multiselectable="true"
      className="z-overlay-popover fixed flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark"
      style={{
        top: dropdownLayout.top,
        left: dropdownLayout.left,
        width: dropdownLayout.width,
        maxHeight: dropdownLayout.maxHeight,
      }}
    >
      {searchable && (
        <div className="p-2 border-b border-border dark:border-border-dark flex-shrink-0">
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && filteredOptions.length > 0) {
                e.preventDefault();
                optionsRef.current[0]?.focus();
              }
            }}
            placeholder={searchPlaceholder}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border dark:border-border-dark
                  bg-surface dark:bg-surface-dark
                  text-primary-text dark:text-primary-text-dark
                  placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50
                  focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      <div
        className="overflow-y-auto overscroll-contain flex-1 min-h-0 touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {filteredOptions.length === 0 ? (
          <div className="px-4 py-3 text-sm text-primary-text/60 dark:text-primary-text-dark/60">
            {options.length === 0 ? 'No options' : 'No matches'}
          </div>
        ) : (
          filteredOptions.map((opt, index) => {
            const isSelected = selectedValueSet.has(opt.value);
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  if (el) optionsRef.current[index] = el;
                }}
                type="button"
                data-value={opt.value}
                onClick={() => onToggleOption(opt.value)}
                className={`flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm transition-colors
                    ${
                      isSelected
                        ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
                        : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
                    }
                    focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
                    touch-manipulation`}
              >
                <span
                  className={`size-4 border rounded flex items-center justify-center flex-shrink-0
                    ${
                      isSelected
                        ? 'border-accent dark:border-accent-dark bg-accent dark:bg-accent-dark'
                        : 'border-border dark:border-border-dark'
                    }`}
                >
                  {isSelected && (
                    <svg className="size-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                {opt.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
