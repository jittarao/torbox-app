'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Children, isValidElement, Fragment } from 'react';

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
 */
export default function Select({
  value,
  onChange,
  children,
  className = '',
  placeholder = 'Select...',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const selectRef = useRef(null);
  const dropdownRef = useRef(null);
  const optionsRef = useRef([]);

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
          label: typeof node.props.children === 'string'
            ? node.props.children
            : String(node.props.children),
          group: groupLabel,
          title: node.props.title || null,
        };
        
        if (groupLabel) {
          // Find or create the optgroup
          let group = optgroups.find(g => g.label === groupLabel);
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
  const allOptions = useMemo(() => [
    ...options,
    ...optgroups.flatMap((group) => group.options),
  ], [options, optgroups]);

  // Find selected option label
  useEffect(() => {
    const selected = allOptions.find((opt) => String(opt.value) === String(value));
    setSelectedLabel(selected ? selected.label : '');
  }, [value, allOptions]);

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
  }, [isOpen, disabled]);

  const handleSelect = (selectedValue) => {
    onChange({ target: { value: selectedValue } });
    setIsOpen(false);
    selectRef.current?.focus();
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

  // Build options list with optgroups
  const renderOptions = () => {
    const items = [];
    let optionIndex = 0;

    // Add standalone options first
    options.forEach((opt) => {
      const isSelected = String(opt.value) === String(value);
        items.push(
        <button
          key={`opt-${opt.value}`}
          ref={(el) => {
            if (el) optionsRef.current[optionIndex] = el;
          }}
          type="button"
          data-value={opt.value}
          onClick={() => handleSelect(opt.value)}
          onMouseEnter={(e) => e.currentTarget.focus()}
          title={opt.title || undefined}
          className={`block w-full text-left px-4 py-2 text-sm transition-colors
            ${isSelected
              ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
              : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
            }
            focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
            touch-manipulation`}
        >
          {opt.label}
        </button>,
      );
      optionIndex++;
    });

    // Add optgroups
    optgroups.forEach((group) => {
      items.push(
        <div key={`group-${group.label}`} className="sticky top-0 z-10">
          <div className="px-3 py-1.5 text-xs font-semibold text-primary-text/60 dark:text-primary-text-dark/60 bg-surface/50 dark:bg-surface-dark/50 border-b border-border dark:border-border-dark">
            {group.label}
          </div>
        </div>,
      );

      group.options.forEach((opt) => {
        const isSelected = String(opt.value) === String(value);
        items.push(
          <button
            key={`opt-${opt.value}`}
            ref={(el) => {
              if (el) optionsRef.current[optionIndex] = el;
            }}
            type="button"
            data-value={opt.value}
            onClick={() => handleSelect(opt.value)}
            onMouseEnter={(e) => e.currentTarget.focus()}
            title={opt.title || undefined}
            className={`block w-full text-left px-4 py-2 pl-6 text-sm transition-colors
              ${isSelected
                ? 'text-accent dark:text-accent-dark bg-accent/10 dark:bg-accent-dark/10 font-medium'
                : 'text-primary-text dark:text-primary-text-dark hover:bg-accent/5 dark:hover:bg-surface-alt-hover-dark'
              }
              focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-dark focus:ring-inset
              touch-manipulation`}
          >
            {opt.label}
          </button>,
        );
        optionIndex++;
      });
    });

    return items;
  };

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
        <span className="truncate">
          {selectedLabel || placeholder}
        </span>
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
              w-max max-h-64 md:max-h-[50vh] z-50 overflow-y-auto overscroll-contain"
            role="listbox"
          >
            {renderOptions()}
          </div>
        </>
      )}
    </div>
  );
}

