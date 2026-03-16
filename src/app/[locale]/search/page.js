'use client';
import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import SearchBar from '@/components/search/SearchBar';
import SearchResults from '@/components/search/SearchResults';
import { fetchUserProfile, getUserPermissions, hasDownloadAccess } from '@/utils/userProfile';
import { useSearchStore } from '@/store/searchStore';

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function SearchPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState(null);

  const searchType = useSearchStore((state) => state.searchType);
  const setSearchType = useSearchStore((state) => state.setSearchType);

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

  // Fetch user profile and derive permissions (usenet search requires Pro)
  useEffect(() => {
    if (apiKey && apiKey.length >= 20) {
      fetchUserProfile(apiKey)
        .then((userData) => {
          setPermissions(userData ? getUserPermissions(userData) : null);
        })
        .catch(() => setPermissions(null));
    } else {
      setPermissions(null);
    }
  }, [apiKey]);

  // If usenet is selected but user doesn't have access, switch to torrents
  useEffect(() => {
    if (permissions && searchType === 'usenet' && !hasDownloadAccess('usenet', permissions)) {
      setSearchType('torrents');
    }
  }, [permissions, searchType, setSearchType]);

  const searchTypeOptions = useMemo(() => {
    const torrents = { value: 'torrents', labelKey: 'itemTypes.Torrents' };
    const usenet = { value: 'usenet', labelKey: 'itemTypes.Usenet' };
    const canUsenet = hasDownloadAccess('usenet', permissions);
    return [
      torrents,
      ...(canUsenet ? [usenet] : []),
    ];
  }, [permissions]);

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
        <SearchBar searchTypeOptions={searchTypeOptions} />
        <SearchResults apiKey={apiKey} />
      </div>
    </main>
  );
}
