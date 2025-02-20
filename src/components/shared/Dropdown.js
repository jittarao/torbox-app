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

  const selectedOption = options.find(option => 
    option.value === value || JSON.stringify(option.value) === value
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full p-2 text-sm rounded 
          bg-white dark:bg-gray-800 border dark:border-gray-700 
          hover:border-gray-400 dark:hover:border-gray-600
          text-gray-700 dark:text-gray-200 ${className}`}
      >
        <span>{selectedOption?.label || 'Select...'}</span>
        <svg 
          className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg">
          {options.map((option) => (
            <button
              key={option.label}
              onClick={() => {
                onChange(option.value === 'all' ? option.value : JSON.stringify(option.value));
                setIsOpen(false);
              }}
              className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700
                ${(option.value === value || JSON.stringify(option.value) === value) 
                  ? 'bg-gray-100 dark:bg-gray-700' 
                  : ''}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 