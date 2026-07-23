'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { Children, isValidElement, Fragment } from 'react';
import OverlayPortal from '@/components/shared/OverlayPortal';

/**
 * Custom Select component with mobile-responsive design
 * Supports optgroups and provides better UX than native select
 *
 * @param {Object} props
 * @param {string} props.value - Current selected value
 * @param {Function} props.onChange - Callback when value changes
 * @param {Array|React.ReactNode} props.children - Option elements (can include optgroups)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.placeholder - Placeholder text when no value selected
 * @param {boolean} props.disabled - Whether select is disabled
 * @param {boolean} props.searchable - Show search field in the dropdown
 * @param {string} props.searchPlaceholder - Placeholder for search input
 */
function OptionsList({
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

export default function Select({
  value,
  onChange,
  children,
  className = '',
  placeholder = 'Select...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  noMatchesMessage = 'No matches',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownLayout, setDropdownLayout] = useState(null);
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const optionsRef = useRef([]);

  const updateDropdownPosition = useCallback(() => {
    const el = selectRef.current;
    if (!el || !isOpen) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const margin = 8;
    const gap = 4;
    // Use most of the viewport below/above the trigger (capped for very tall screens)
    const preferredMax = Math.min(560, Math.round(vh * 0.72));
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
    const minWidth = rect.width;
    if (left + minWidth > vw - margin) {
      left = Math.max(margin, vw - minWidth - margin);
    }
    if (left < margin) left = margin;

    setDropdownLayout({ top, left, minWidth, maxHeight });
  }, [isOpen]);

  // Parse children to extract options and optgroups
  const parseOptions = (children) => {
    const options = [];
    const optgroups = [];

    const processNode = (node, groupLabel = null) => {
      if (!node) return;

      // Handle arrays - recursively process each element
      if (Array.isArray(node)) {
        node.forEach((child) => {
          processNode(child, groupLabel);
        });
        return;
      }

      // Handle React fragments - recursively process their children
      if (isValidElement(node) && node.type === Fragment) {
        const fragmentChildren = Children.toArray(node.props?.children || []);
        fragmentChildren.forEach((child) => {
          processNode(child, groupLabel);
        });
        return;
      }

      if (!isValidElement(node)) return;

      if (node.type === 'optgroup') {
        const groupLabel = node.props?.label || '';
        const groupChildren = Children.toArray(node.props?.children || []);

        groupChildren.forEach((opt) => {
          processNode(opt, groupLabel);
        });
      } else if (node.type === 'option') {
        const optionData = {
          value: node.props.value,
          label:
            typeof node.props.children === 'string'
              ? node.props.children
              : String(node.props.children),
          group: groupLabel,
          title: node.props.title || null,
        };

        if (groupLabel) {
          // Find or create the optgroup
          let group = optgroups.find((g) => g.label === groupLabel);
          if (!group) {
            group = { label: groupLabel, options: [] };
            optgroups.push(group);
          }
          group.options.push(optionData);
        } else {
          options.push(optionData);
        }
      }
    };

    // Use toArray to flatten all fragments and arrays
    const flatChildren = Children.toArray(children);
    flatChildren.forEach((child) => {
      processNode(child);
    });

    return { options, optgroups };
  };

  const { options, optgroups } = useMemo(() => parseOptions(children), [children]);
  const allOptions = useMemo(
    () => [...options, ...optgroups.flatMap((group) => group.options)],
    [options, optgroups]
  );

  const { filteredOptions, filteredOptgroups, filteredOptionCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!searchable || !q) {
      const count = options.length + optgroups.reduce((n, g) => n + g.options.length, 0);
      return { filteredOptions: options, filteredOptgroups: optgroups, filteredOptionCount: count };
    }

    const matches = (opt) => String(opt.label).toLowerCase().includes(q);
    const nextOptions = options.filter(matches);
    const nextOptgroups = optgroups.reduce((acc, group) => {
      const options = group.options.filter(matches);
      if (options.length > 0) {
        acc.push({ ...group, options });
      }
      return acc;
    }, []);
    const count = nextOptions.length + nextOptgroups.reduce((n, g) => n + g.options.length, 0);

    return {
      filteredOptions: nextOptions,
      filteredOptgroups: nextOptgroups,
      filteredOptionCount: count,
    };
  }, [options, optgroups, searchQuery, searchable]);

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
  }, [isOpen, updateDropdownPosition, filteredOptionCount]);

  useEffect(() => {
    if (!isOpen || !searchable) return;
    const t = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(t);
  }, [isOpen, searchable]);

  // Find selected option label
  const selectedLabel = useMemo(
    () => allOptions.find((opt) => String(opt.value) === String(value))?.label ?? '',
    [value, allOptions]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setSearchQuery('');
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const closeDropdown = useCallback(() => {
    setSearchQuery('');
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (selectedValue) => {
      onChange({ target: { value: selectedValue } });
      closeDropdown();
      selectRef.current?.focus();
    },
    [onChange, closeDropdown]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen || disabled) return;

      if (searchable && event.target === searchInputRef.current) {
        return;
      }

      if (event.key === 'Escape') {
        closeDropdown();
        selectRef.current?.focus();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        const currentIndex = optionsRef.current.findIndex((ref) => ref === document.activeElement);
        const nextIndex = Math.min(currentIndex + 1, optionsRef.current.length - 1);
        optionsRef.current[nextIndex]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const currentIndex = optionsRef.current.findIndex((ref) => ref === document.activeElement);
        const prevIndex = Math.max(currentIndex - 1, 0);
        optionsRef.current[prevIndex]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (document.activeElement?.dataset?.value) {
          handleSelect(document.activeElement.dataset.value);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, disabled, handleSelect, searchable, closeDropdown]);

  const handleToggle = () => {
    if (!disabled) {
      if (isOpen) {
        closeDropdown();
      } else {
        setIsOpen(true);
      }
    }
  };

  // Reset options ref when dropdown opens/closes
  useEffect(() => {
    if (!isOpen) {
      optionsRef.current = [];
    }
  }, [isOpen]);

  const dropdownContent =
    isOpen && dropdownLayout ? (
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
                onChange={(e) => setSearchQuery(e.target.value)}
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
            <OptionsList
              options={filteredOptions}
              optgroups={filteredOptgroups}
              value={value}
              onSelect={handleSelect}
              optionsRef={optionsRef}
              emptyMessage={noMatchesMessage}
            />
          </div>
        </div>
      </>
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
        <span className="truncate">{selectedLabel || placeholder}</span>
        <svg
          className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownContent ? <OverlayPortal open={isOpen}>{dropdownContent}</OverlayPortal> : null}
    </div>
  );
}
