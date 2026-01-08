'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Multi-select component with mobile-responsive design
 * 
 * @param {Object} props
 * @param {Array} props.value - Array of selected values
 * @param {Function} props.onChange - Callback when selection changes (receives array)
 * @param {Array} props.options - Array of { label, value } objects
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.placeholder - Placeholder text when no value selected
 * @param {boolean} props.disabled - Whether select is disabled
 */
export default function MultiSelect({
  value = [],
  onChange,
  options = [],
  className = '',
  placeholder = 'Select...',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);
  const optionsRef = useRef([]);

  // Ensure value is always an array
  const selectedValues = Array.isArray(value) ? value : [];

  // Find selected options
  const selectedOptions = useMemo(() => {
    return options.filter(opt => selectedValues.includes(opt.value));
  }, [options, selectedValues]);

  // Close dropdown when clicking outside
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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen || disabled) return;

      if (event.key === 'Escape') {
        setIsOpen(false);
        selectRef.current?.focus();
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
  }, [isOpen, disabled, selectedValues]);

  const handleToggleOption = (optionValue) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];
    
    onChange(newValues);
  };

  const handleRemoveOption = (optionValue, e) => {
    e.stopPropagation();
    const newValues = selectedValues.filter(v => v !== optionValue);
    onChange(newValues);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Reset options ref when dropdown opens/closes
  useEffect(() => {
    if (!isOpen) {
      optionsRef.current = [];
    }
  }, [isOpen]);

  // Display text
  const displayText = useMemo(() => {
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (selectedOptions.length === 1) {
      return selectedOptions[0].label;
    }
    return `${selectedOptions.length} selected`;
  }, [selectedOptions, placeholder]);

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
            <span className="truncate">
              {displayText}
            </span>
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

      {isOpen && (
        <>
          {/* Mobile overlay */}
          <div
            className="fixed inset-0 bg-black/20 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-surface dark:bg-surface-dark
              border border-border dark:border-border-dark rounded-md shadow-lg
              max-h-64 md:max-h-[50vh] overflow-y-auto overscroll-contain"
            role="listbox"
          >
            {options.map((opt, index) => {
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
                  className={`flex items-center gap-2 w-full text-left px-4 py-2 text-sm transition-colors
                    ${isSelected
                      ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
                      : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
                    }
                    focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
                    touch-manipulation`}
                >
                  <span className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0
                    ${isSelected
                      ? 'border-accent dark:border-accent-dark bg-accent dark:bg-accent-dark'
                      : 'border-border dark:border-border-dark'
                    }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
