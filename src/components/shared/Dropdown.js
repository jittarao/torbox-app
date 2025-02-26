'use client';
import { useState, useRef, useEffect } from 'react';

export default function Dropdown({ options, value, onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (option) =>
      option.value === value || JSON.stringify(option.value) === value,
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-2 text-sm rounded 
          bg-transparent border border-border dark:border-border-dark 
          text-primary-text dark:text-primary-text-dark
          hover:border-accent/50 dark:hover:border-accent-dark/50 
          transition-colors ${className}`}
      >
        <span>{selectedOption?.label || 'Select...'}</span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
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
        <div
          className="absolute z-10 w-full mt-1 bg-surface dark:bg-surface-dark 
          border border-border dark:border-border-dark rounded shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.label}
              onClick={() => {
                const newValue =
                  typeof option.value === 'object'
                    ? JSON.stringify(option.value)
                    : option.value;
                onChange(newValue);
                setIsOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm
                text-primary-text dark:text-primary-text-dark
                hover:bg-surface-alt/90 dark:hover:bg-accent-dark/10
                transition-colors
                ${
                  option.value === value ||
                  JSON.stringify(option.value) === value
                    ? 'bg-surface-hover dark:bg-surface-hover-dark'
                    : ''
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
