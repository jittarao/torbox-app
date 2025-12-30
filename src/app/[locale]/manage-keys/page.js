'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import ApiKeyManager from '@/components/downloads/ApiKeyManager';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function ManageKeysPage() {
    const [apiKey, setApiKey] = useState('');
    const [isClient, setIsClient] = useState(false);

    const t = useTranslations('ApiKeyManager');
    const navT = useTranslations('Header');

    useEffect(() => {
        setIsClient(true);

        // Load API key from storage
        const storedKey = localStorage.getItem('torboxApiKey');
        if (storedKey) {
            setApiKey(storedKey);
        }
    }, []);

    // Handle API key change
    const handleKeyChange = (newKey) => {
        setApiKey(newKey);
        if (newKey) {
            localStorage.setItem('torboxApiKey', newKey);
        } else {
            localStorage.removeItem('torboxApiKey');
            // If no key, the Header or main layout might handle redirect, 
            // but usually we want to go home
            window.location.href = '/';
        }
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
            <Header apiKey={apiKey} />

            <div className="container mx-auto px-4 py-8">
                <div className="max-w-2xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-primary-text dark:text-primary-text-dark mb-2 tracking-tight">
                            {navT('menu.manageKeys') || 'Manage API Keys'}
                        </h1>
                        <p className="text-primary-text/60 dark:text-primary-text-dark/60 font-medium">
                            Add, remove, or switch between multiple TorBox accounts.
                        </p>
                    </div>

                    <div className="glass rounded-[2rem] p-2 shadow-xl border border-border/10">
                        <ApiKeyManager
                            activeKey={apiKey}
                            onKeySelect={handleKeyChange}
                            onClose={() => { }} // No-op since it's a page now
                            keepOpen={true} // Always open on this page
                            onKeepOpenToggle={() => { }} // No-op
                        />
                    </div>

                    <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/10">
                        <div className="flex gap-4 items-start">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="font-bold text-primary-text dark:text-primary-text-dark">How to use</h4>
                                <p className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 mt-1 leading-relaxed">
                                    Your API keys are stored securely on the server. You can add multiple keys and switch between them instantly. The active key will be used for all downloads and searches.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
