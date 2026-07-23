import SelectOptionsList from './SelectOptionsList';

export default function SelectDropdown({
  dropdownRef,
  dropdownLayout,
  closeDropdown,
  selectRef,
  searchable,
  searchQuery,
  onSearchQueryChange,
  searchInputRef,
  searchPlaceholder,
  filteredOptions,
  filteredOptgroups,
  filteredOptionCount,
  value,
  onSelect,
  optionsRef,
  noMatchesMessage,
}) {
  return (
    <>
      <div
        className="z-overlay-popover-backdrop fixed inset-0 bg-black/20 sm:hidden"
        onClick={closeDropdown}
        aria-hidden="true"
      />
      <div
        ref={dropdownRef}
        role="listbox"
        className="z-overlay-popover fixed flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-lg dark:border-border-dark dark:bg-surface-dark"
        style={{
          top: dropdownLayout.top,
          left: dropdownLayout.left,
          minWidth: dropdownLayout.minWidth,
          maxHeight: dropdownLayout.maxHeight,
          maxWidth: `calc(100vw - ${dropdownLayout.left}px - 8px)`,
        }}
      >
        {searchable && (
          <div className="flex-shrink-0 border-b border-border p-2 dark:border-border-dark">
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault();
                  closeDropdown();
                  selectRef.current?.focus();
                } else if (e.key === 'ArrowDown' && filteredOptionCount > 0) {
                  e.preventDefault();
                  optionsRef.current[0]?.focus();
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-primary-text dark:border-border-dark dark:bg-surface-dark dark:text-primary-text-dark placeholder:text-primary-text/50 dark:placeholder:text-primary-text-dark/50 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={searchPlaceholder}
            />
          </div>
        )}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <SelectOptionsList
            options={filteredOptions}
            optgroups={filteredOptgroups}
            value={value}
            onSelect={onSelect}
            optionsRef={optionsRef}
            emptyMessage={noMatchesMessage}
          />
        </div>
      </div>
    </>
  );
}
