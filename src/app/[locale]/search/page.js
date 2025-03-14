'use client';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import SearchBar from '@/components/search/SearchBar';
import SearchResults from '@/components/search/SearchResults';

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function SearchPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
    setLoading(false);
  }, []);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
  };

  if (loading) return null;

  return (
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans
                  text-primary-text dark:text-primary-text-dark`}
    >
      <Header />
      <div className="max-w-7xl mx-auto p-4">
        <ApiKeyInput
          value={apiKey}
          onKeyChange={handleKeyChange}
          allowKeyManager={true}
        />
        <SearchBar />
        <SearchResults apiKey={apiKey} />
      </div>
    </main>
  );
}
