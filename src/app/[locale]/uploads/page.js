'use client';

import UploadManager from '@/components/uploads/UploadManager';
import Header from '@/components/Header';
import { Inter } from 'next/font/google';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function UploadsPage() {
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
        ensureUserDb(loadedKey)
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

    setLoading(false);
  }, []);

  if (loading) return null;

  return (
    <main className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}>
      <Header apiKey={apiKey} />
      <div className="container mx-auto p-4">
        <UploadManager apiKey={apiKey} />
      </div>
    </main>
  );
}
