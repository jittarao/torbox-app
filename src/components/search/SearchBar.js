'use client';
import { useState } from 'react';
import { useSearchStore } from '@/stores/searchStore';

export default function SearchBar() {
  const [localQuery, setLocalQuery] = useState('');
  const setQuery = useSearchStore(state => state.setQuery);

  const handleChange = (e) => {
    const value = e.target.value;
    setLocalQuery(value);
  };

  const handleSearch = () => {
    setQuery(localQuery);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={localQuery}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search torrents..."
        className="w-full px-4 py-2 pl-12 rounded-lg border border-border dark:border-border-dark
          bg-transparent text-primary-text dark:text-primary-text-dark 
          placeholder-primary-text/50 dark:placeholder-primary-text-dark/50
          focus:outline-none focus:ring-2 focus:ring-accent/20 dark:focus:ring-accent-dark/20 
          focus:border-accent dark:focus:border-accent-dark
          transition-colors"
      />
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 absolute left-3 top-1/2 transform -translate-y-1/2 
                   text-primary-text/40 dark:text-primary-text-dark/40" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
        />
      </svg>
    </div>
  );
} 