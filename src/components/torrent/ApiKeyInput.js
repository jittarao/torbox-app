'use client';
import { useState } from 'react';

export default function ApiKeyInput({ value, onKeyChange }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="mb-4 relative">
      <input
        type={showKey ? 'text' : 'password'}
        value={value}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="Enter TorBox API Key"
        className="w-full p-3 border border-border dark:border-border-dark rounded-lg 
          bg-transparent text-primary-text dark:text-primary-text-dark 
          placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
          focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
          focus:border-accent dark:focus:border-accent-dark
          transition-colors"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShowKey(!showKey)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-text/50 
          dark:text-primary-text-dark/50 hover:text-primary-text 
          dark:hover:text-primary-text-dark transition-colors"
      >
        {showKey ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
            <path d="m2 2 20 20" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
