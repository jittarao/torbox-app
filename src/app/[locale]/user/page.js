'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import UserProfile from '@/components/user/UserProfile';
import Toast from '@/components/shared/Toast';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function UserPage() {
  const [toast, setToast] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [isClient, setIsClient] = useState(false);
  
  // Move translations hook to top level - always call it
  const t = useTranslations('User');

  useEffect(() => {
    setIsClient(true);

    // Load API key from storage
    const storedKey = localStorage.getItem('torboxApiKey');
    const storedKeys = localStorage.getItem('torboxApiKeys');

    let loadedKey = null;
    if (storedKey) {
      loadedKey = storedKey;
      setApiKey(storedKey);
    } else if (storedKeys) {
      // If no active key but we have stored keys, use the first one
      try {
        const keys = JSON.parse(storedKeys);
        if (keys.length > 0) {
          loadedKey = keys[0].key;
          setApiKey(keys[0].key);
          localStorage.setItem('torboxApiKey', keys[0].key);
        }
      } catch (error) {
        console.error('Error parsing API keys from localStorage:', error);
      }
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
  }, []);

  // Handle API key change
  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
  };

  // Don't render anything until client-side hydration is complete
  if (!isClient) {
    return (
      <div
        className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
      ></div>
    );
  }

  return (
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <Header 
        apiKey={apiKey} 
        onApiKeyChange={handleKeyChange}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text dark:text-text-dark mb-2">
            {t('title')}
          </h1>
          <p className="text-muted dark:text-muted-dark">
            {t('description')}
          </p>
        </div>

        {/* User Profile Content */}
        <div>
          <ErrorBoundary>
            <UserProfile 
              apiKey={apiKey} 
              setToast={setToast}
            />
          </ErrorBoundary>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}

// Simple Error Boundary Component
function ErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 text-red-500 mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="text-red-600 dark:text-red-400 mb-4">Something went wrong with this component</p>
          <button
            onClick={() => setHasError(false)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  try {
    return children;
  } catch (error) {
    console.error('Error in user page component:', error);
    setHasError(true);
    return null;
  }
}
