'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import OverlayPortal from '@/components/shared/OverlayPortal';
import { computeOverlayDropdownLayout } from '@/components/shared/computeOverlayDropdownLayout';
import SelectDropdown from '@/components/shared/select/SelectDropdown';
import {
  filterSelectOptions,
  parseSelectOptions,
} from '@/components/shared/select/parseSelectOptions';

/**
 * Custom Select component with mobile-responsive design
 * Supports optgroups and provides better UX than native select
 */
export default function Select({
  id,
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
    setDropdownLayout(computeOverlayDropdownLayout(rect));
  }, [isOpen]);

  const { options, optgroups } = useMemo(() => parseSelectOptions(children), [children]);
  const allOptions = useMemo(
    () => [...options, ...optgroups.flatMap((group) => group.options)],
    [options, optgroups]
  );

  const { filteredOptions, filteredOptgroups, filteredOptionCount } = useMemo(
    () => filterSelectOptions(options, optgroups, searchQuery, searchable),
    [options, optgroups, searchQuery, searchable]
  );

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

  const selectedLabel = useMemo(
    () => allOptions.find((opt) => String(opt.value) === String(value))?.label ?? '',
    [value, allOptions]
  );

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

  useEffect(() => {
    if (!isOpen) {
      optionsRef.current = [];
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        id={id}
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

      {isOpen && dropdownLayout ? (
        <OverlayPortal open={isOpen}>
          <SelectDropdown
            dropdownRef={dropdownRef}
            dropdownLayout={dropdownLayout}
            closeDropdown={closeDropdown}
            selectRef={selectRef}
            searchable={searchable}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchInputRef={searchInputRef}
            searchPlaceholder={searchPlaceholder}
            filteredOptions={filteredOptions}
            filteredOptgroups={filteredOptgroups}
            filteredOptionCount={filteredOptionCount}
            value={value}
            onSelect={handleSelect}
            optionsRef={optionsRef}
            noMatchesMessage={noMatchesMessage}
          />
        </OverlayPortal>
      ) : null}
    </div>
  );
}
