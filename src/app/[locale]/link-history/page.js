'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import LinkHistory from '@/components/LinkHistory';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function LinkHistoryPage() {
  const [history, setHistory] = useState([]);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    try {
      const downloadHistory = JSON.parse(
        localStorage.getItem('torboxDownloadHistory') || '[]',
      );
      const storedKey = localStorage.getItem('torboxApiKey');
      
      setHistory(downloadHistory);
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
    } catch (error) {
      console.error('Error parsing download history from localStorage:', error);
      setHistory([]);
    }
  }, []);

  const deleteHistoryItem = (id) => {
    const newHistory = history.filter((item) => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('torboxDownloadHistory', JSON.stringify(newHistory));
  };

  return (
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <Header apiKey={apiKey} />
      <div className="container mx-auto p-4">
        <LinkHistory history={history} onDelete={deleteHistoryItem} />
      </div>
    </main>
  );
}
