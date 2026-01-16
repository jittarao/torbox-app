'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import LinkHistory from '@/components/LinkHistory';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function LinkHistoryPage() {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const storedKey = localStorage.getItem('torboxApiKey');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  return (
    <main className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}>
      <Header apiKey={apiKey} />
      <div className="container mx-auto p-4">
        <LinkHistory apiKey={apiKey} />
      </div>
    </main>
  );
}
