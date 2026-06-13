'use client';
import { Suspense, useEffect, useMemo } from 'react';
import AppShell from '@/components/navigation/AppShell';
import ApiKeyInput from '@/components/downloads/ApiKeyInput';
import SearchBar from '@/components/search/SearchBar';
import SearchResults from '@/components/search/SearchResults';
import { hasDownloadAccess } from '@/utils/userProfile';
import { useSearchStore } from '@/store/searchStore';
import { useSession } from '@/components/shared/hooks/useSession';

export default function SearchPageClient() {
  const { apiKey, hydrated, permissions, setApiKey } = useSession();

  const searchType = useSearchStore((state) => state.searchType);
  const setSearchType = useSearchStore((state) => state.setSearchType);

  const initEnsureUserDb = (key) => {
    if (key) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(key)
          .then((result) => {
            if (result.success && result.wasCreated) {
              console.log('User database created for existing API key');
            }
          })
          .catch((error) => {
            console.error('Error ensuring user database on load:', error);
          });
      });
    }
  };

  useEffect(() => {
    initEnsureUserDb(apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (permissions && searchType === 'usenet' && !hasDownloadAccess('usenet', permissions)) {
      setSearchType('torrents');
    }
  }, [permissions, searchType, setSearchType]);

  const searchTypeOptions = useMemo(() => {
    const torrents = { value: 'torrents', labelKey: 'itemTypes.Torrents' };
    const usenet = { value: 'usenet', labelKey: 'itemTypes.Usenet' };
    const canUsenet = hasDownloadAccess('usenet', permissions);
    return [...(canUsenet ? [usenet] : []), torrents];
  }, [permissions]);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    initEnsureUserDb(newKey);
  };

  if (!hydrated) {
    return <div className="min-h-screen bg-surface dark:bg-surface-dark font-sans" aria-hidden />;
  }

  return (
    <AppShell
      apiKey={apiKey}
      className="min-h-screen bg-surface dark:bg-surface-dark font-sans text-primary-text dark:text-primary-text-dark"
    >
      <div className="max-w-7xl mx-auto p-4">
        <ApiKeyInput value={apiKey} onKeyChange={handleKeyChange} allowKeyManager={true} />
        <Suspense fallback={null}>
          <SearchBar searchTypeOptions={searchTypeOptions} />
          <SearchResults apiKey={apiKey} />
        </Suspense>
      </div>
    </AppShell>
  );
}
