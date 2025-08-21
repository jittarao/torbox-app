'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import RssFeedManager from '@/components/rss/RssFeedManager';
import Toast from '@/components/shared/Toast';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RssPage() {
  const t = useTranslations('RssFeeds');
  const [toast, setToast] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Load API key from storage (same as main page)
    const storedKey = localStorage.getItem('torboxApiKey');
    const storedKeys = localStorage.getItem('torboxApiKeys');

    if (storedKey) {
      setApiKey(storedKey);
    } else if (storedKeys) {
      // If no active key but we have stored keys, use the first one
      const keys = JSON.parse(storedKeys);
      if (keys.length > 0) {
        setApiKey(keys[0].key);
        localStorage.setItem('torboxApiKey', keys[0].key);
      }
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
      {!apiKey ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">API Key Required</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please enter your TorBox API key to access RSS feeds.
            </p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                Please go to the main Downloads page to enter your API key.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Header apiKey={apiKey} />
          <div className="container mx-auto p-4">
            <div className="max-w-4xl mx-auto">
              <RssFeedManager apiKey={apiKey} setToast={setToast} />
            </div>
          </div>
        </>
      )}
      
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
