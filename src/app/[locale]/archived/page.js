'use client';

import ArchivedDownloads from '@/components/ArchivedDownloads';
import Header from '@/components/Header';
import { Inter } from 'next/font/google';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function ArchivedDownloadsPage() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  return (
    <main
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <Header />
      <div className="container mx-auto p-4">
        <ArchivedDownloads apiKey={apiKey} />
      </div>
    </main>
  );
}
