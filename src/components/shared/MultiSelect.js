'use client';

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Multi-select with optional search; dropdown is portaled with fixed positioning
 * so it is not clipped by modal overflow and scrolls reliably on touch devices.
 *
 * @param {Object} props
 * @param {Array} props.value - Array of selected values
 * @param {Function} props.onChange - Callback when selection changes (receives array)
 * @param {Array} props.options - Array of { label, value } objects
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.placeholder - Placeholder text when no value selected
 * @param {boolean} props.disabled - Whether select is disabled
 * @param {boolean} props.searchable - Show search field in the dropdown
 * @param {string} props.searchPlaceholder - Placeholder for search input
 */
export default function MultiSelect({
  value = [],
  onChange,
  options = [],
  className = '',
  placeholder = 'Select...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownLayout, setDropdownLayout] = useState(null);
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsRef = useRef([]);

  const selectedValues = Array.isArray(value) ? value : [];

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) =>
      String(opt.label).toLowerCase().includes(q),
    );
  }, [options, searchQuery]);

  const selectedOptions = useMemo(() => {
    return options.filter((opt) => selectedValues.includes(opt.value));
  }, [options, selectedValues]);

  const updateDropdownPosition = useCallback(() => {
    const el = selectRef.current;
    if (!el || !isOpen) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 8;
    const gap = 4;
    const preferredMax = Math.min(320, Math.round(vh * 0.55));
    const minUsable = 140;

    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;

    let top;
    let maxHeight;

    if (spaceBelow >= minUsable || spaceBelow >= spaceAbove) {
      top = rect.bottom + gap;
      maxHeight = Math.min(preferredMax, spaceBelow);
    } else {
      maxHeight = Math.min(preferredMax, spaceAbove - gap);
      top = rect.top - gap - maxHeight;
    }

    maxHeight = Math.max(maxHeight, minUsable);

    let left = rect.left;
    let width = rect.width;
    if (left + width > vw - margin) {
      left = Math.max(margin, vw - width - margin);
    }
    if (left < margin) left = margin;

    setDropdownLayout({ top, left, width, maxHeight });
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setDropdownLayout(null);
      return;
    }
    updateDropdownPosition();
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition, filteredOptions.length]);

  useEffect(() => {
    if (!isOpen || !searchable) return;
    const t = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [isOpen, searchable]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOption = useCallback(
    (optionValue) => {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];

      onChange(newValues);
    },
    [selectedValues, onChange],
  );

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen || disabled) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
        selectRef.current?.focus();
      } else if (event.target === searchInputRef.current) {
        return;
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const currentIndex = optionsRef.current.findIndex(
          (ref) => ref === document.activeElement,
        );
        const nextIndex = Math.min(
          currentIndex + 1,
          optionsRef.current.length - 1,
        );
        optionsRef.current[nextIndex]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const currentIndex = optionsRef.current.findIndex(
          (ref) => ref === document.activeElement,
        );
        const prevIndex = Math.max(currentIndex - 1, 0);
        optionsRef.current[prevIndex]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (document.activeElement?.dataset?.value) {
          handleToggleOption(document.activeElement.dataset.value);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, disabled, handleToggleOption]);

  const handleRemoveOption = (optionValue, e) => {
    e.stopPropagation();
    const newValues = selectedValues.filter((v) => v !== optionValue);
    onChange(newValues);
  };

  const handleToggle = () => {
    if (!disabled) {
      if (!isOpen) {
        setSearchQuery('');
      }
      setIsOpen(!isOpen);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      optionsRef.current = [];
      setSearchQuery('');
    }
  }, [isOpen]);

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }
    return `${selectedOptions.length} selected`;
  }, [selectedOptions, placeholder]);

  const portalTarget =
    typeof document !== 'undefined' ? document.body : null;

  if (isOpen) {
    optionsRef.current = [];
  }

  const dropdownContent =
    isOpen && dropdownLayout && portalTarget ? (
      <div
          ref={dropdownRef}
          className="fixed z-[100] bg-surface dark:bg-surface-dark
            border border-border dark:border-border-dark rounded-md shadow-lg
            flex flex-col overflow-hidden"
          style={{
            top: dropdownLayout.top,
            left: dropdownLayout.left,
            width: dropdownLayout.width,
            maxHeight: dropdownLayout.maxHeight,
          }}
          role="listbox"
        >
          {searchable && (
            <div className="p-2 border-b border-border dark:border-border-dark flex-shrink-0">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    ref={(el) => {
                      if (el) optionsRef.current[index] = el;
                    }}
                    type="button"
                    data-value={opt.value}
                    onClick={() => handleToggleOption(opt.value)}
                    onMouseEnter={(e) => e.currentTarget.focus()}
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
                      className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0
                    ${
                      isSelected
                        ? 'border-accent dark:border-accent-dark bg-accent dark:bg-accent-dark'
                        : 'border-border dark:border-border-dark'
                    }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
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
    ) : null;

  return (
    <div className="relative">
      <button
        ref={selectRef}
        type="button"
        onClick={handleToggle}
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
                    onClick={(e) => handleRemoveOption(opt.value, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRemoveOption(opt.value, e);
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
          className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {portalTarget && dropdownContent
        ? createPortal(dropdownContent, portalTarget)
        : null}
    </div>
  );
}
