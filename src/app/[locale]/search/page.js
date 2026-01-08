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
    let loadedKey = null;
    if (storedKey) {
      loadedKey = storedKey;
      setApiKey(storedKey);
    }
    
    // Ensure user database exists for loaded API key
    if (loadedKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(loadedKey).then((result) => {
          if (result.success && result.wasCreated) {
            console.log('User database created for existing API key');
          }
        }).catch((error) => {
          console.error('Error ensuring user database on load:', error);
        });
      });
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
      <Header apiKey={apiKey} />
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
