'use client';
import { useState } from 'react';
import { Icons } from '@/components/constants';

export default function ApiKeyInput({ value, onKeyChange }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="mb-4 relative">
      <input
        type={showKey ? 'text' : 'password'}
        value={value}
        onChange={(e) => onKeyChange(e.target.value)}
        placeholder="Enter TorBox API Key"
        className="w-full px-3 py-2 pr-12 md:p-3.5 text-sm md:text-base border border-border dark:border-border-dark rounded-lg 
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
        className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-primary-text/50 
          dark:text-primary-text-dark/50 hover:text-primary-text 
          dark:hover:text-primary-text-dark transition-colors
          p-2 touch-manipulation"
        aria-label={showKey ? 'Hide API key' : 'Show API key'}
      >
        {showKey ? Icons.eye : Icons.eyeOff}
      </button>
    </div>
  );
}
