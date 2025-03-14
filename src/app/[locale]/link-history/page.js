'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import LinkHistory from '@/components/LinkHistory';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function LinkHistoryPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const downloadHistory = JSON.parse(
      localStorage.getItem('torboxDownloadHistory') || '[]',
    );

    setHistory(downloadHistory);
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
      <Header />
      <div className="container mx-auto p-4">
        <LinkHistory history={history} onDelete={deleteHistoryItem} />
      </div>
    </main>
  );
}
