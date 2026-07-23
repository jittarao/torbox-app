'use client';

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import OverlayPortal from '@/components/shared/OverlayPortal';
import { computeOverlayDropdownLayout } from '@/components/shared/computeOverlayDropdownLayout';
import MultiSelectDropdown from '@/components/shared/MultiSelectDropdown';
import MultiSelectTrigger from '@/components/shared/MultiSelectTrigger';

const EMPTY_ARRAY = [];

/**
 * Multi-select with optional search; dropdown is portaled with fixed positioning
 * so it is not clipped by modal overflow and scrolls reliably on touch devices.
 */
export default function MultiSelect({
  value = EMPTY_ARRAY,
  onChange,
  options = EMPTY_ARRAY,
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

  const selectedValues = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const selectedValueSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => String(opt.label).toLowerCase().includes(q));
  }, [options, searchQuery]);

  const selectedOptions = useMemo(() => {
    return options.filter((opt) => selectedValueSet.has(opt.value));
  }, [options, selectedValueSet]);

  const updateDropdownPosition = useCallback(() => {
    const el = selectRef.current;
    if (!el || !isOpen) return;
    const rect = el.getBoundingClientRect();
    setDropdownLayout(computeOverlayDropdownLayout(rect, { widthKey: 'width' }));
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
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
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
    [selectedValues, onChange]
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
      } else {
        optionsRef.current = [];
        setSearchQuery('');
      }
      setIsOpen(!isOpen);
    }
  };

  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }
    return `${selectedOptions.length} selected`;
  }, [selectedOptions, placeholder]);

  useLayoutEffect(() => {
    if (isOpen) {
      optionsRef.current = [];
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <MultiSelectTrigger
        selectRef={selectRef}
        disabled={disabled}
        className={className}
        isOpen={isOpen}
        selectedOptions={selectedOptions}
        displayText={displayText}
        onToggle={handleToggle}
        onRemoveOption={handleRemoveOption}
      />

      {isOpen && dropdownLayout ? (
        <OverlayPortal open={isOpen}>
          <MultiSelectDropdown
            dropdownRef={dropdownRef}
            dropdownLayout={dropdownLayout}
            searchable={searchable}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchInputRef={searchInputRef}
            searchPlaceholder={searchPlaceholder}
            filteredOptions={filteredOptions}
            options={options}
            selectedValueSet={selectedValueSet}
            onToggleOption={handleToggleOption}
            optionsRef={optionsRef}
          />
        </OverlayPortal>
      ) : null}
    </div>
  );
}
