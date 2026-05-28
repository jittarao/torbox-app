'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import AppShell from '@/components/navigation/AppShell';
import RssFeedManager from '@/components/rss/RssFeedManager';
import RssItemsManager from '@/components/rss/RssItemsManager';

import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';
import ReferralInlineHint from '@/components/referral/ReferralInlineHint';
import { Inter } from 'next/font/google';
import { useSession } from '@/components/shared/hooks/useSession';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RssPage() {
  const [toast, setToast] = useState(null);
  const { apiKey, hydrated, setApiKey } = useSession();
  const [activeTab, setActiveTab] = useState('feeds');
  const [error, setError] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(false);

  const t = useTranslations('RssFeeds');

  useEffect(() => {
    if (apiKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey).catch((error) => {
          console.error('Error ensuring user database on load:', error);
        });
      });
    }
  }, [apiKey]);

  // Fetch user plan on mount
  useEffect(() => {
    if (!apiKey) return;

    const abortController = new AbortController();

    const fetchUserPlan = async () => {
      setCheckingPlan(true);
      try {
        const response = await fetch('/api/user/me', {
          headers: {
            'x-api-key': apiKey,
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data) {
          setUserPlan(data.data.plan);
        } else {
          setUserPlan(data.plan || data.data?.plan || null);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching user plan:', err);
          setUserPlan(null);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setCheckingPlan(false);
        }
      }
    };

    fetchUserPlan();

    return () => abortController.abort();
  }, [apiKey]);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    if (newKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(newKey).catch((error) => {
          console.error('Error ensuring user database:', error);
        });
      });

      setCheckingPlan(true);
      fetch('/api/user/me', {
        headers: { 'x-api-key': newKey },
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          if (data.success && data.data) {
            setUserPlan(data.data.plan);
          } else {
            setUserPlan(data.plan || data.data?.plan || null);
          }
        })
        .catch((err) => {
          console.error('Error fetching user plan:', err);
          setUserPlan(null);
        })
        .finally(() => setCheckingPlan(false));
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'feeds',
      label: t('tabs.feeds'),
      icon: Icons.Rss,
      component: RssFeedManager,
    },
    {
      id: 'items',
      label: t('tabs.items'),
      icon: Icons.List,
      component: RssItemsManager,
    },
  ];

  // Don't render anything until client-side hydration is complete
  if (!hydrated) {
    return (
      <div
        className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
      ></div>
    );
  }

  // Handle errors
  if (error) {
    return (
      <div className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}>
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-red-600">Error Loading RSS Page</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}>
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">API Key Required</h1>
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
      </div>
    );
  }

  return (
    <AppShell
      apiKey={apiKey}
      className={`min-h-screen bg-surface dark:bg-surface-dark ${inter.variable} font-sans`}
    >
      <div className="container mx-auto p-4">
        <div className="mx-auto max-w-6xl">
          {checkingPlan ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="text-center">
                <Spinner size="lg" />
                <p className="mt-4 text-primary-text dark:text-primary-text-dark">
                  {t('checkingSubscription')}
                </p>
              </div>
            </div>
          ) : userPlan !== 2 ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="max-w-md rounded-lg border border-border bg-surface-alt p-8 text-center dark:border-border-dark dark:bg-surface-alt-dark">
                <Icons.ExclamationTriangle className="mx-auto mb-4 size-16 text-yellow-500" />
                <h2 className="mb-4 text-2xl font-bold text-primary-text dark:text-primary-text-dark">
                  {t('proSubscriptionRequired')}
                </h2>
                <p className="text-primary-text/70 dark:text-primary-text-dark/70">
                  {t('proUserRequired')}
                </p>
                <ReferralInlineHint apiKey={apiKey} />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="mb-2 text-3xl font-bold text-primary-text dark:text-primary-text-dark">
                  {t('pageTitle')}
                </h1>
                <p className="text-primary-text/70 dark:text-primary-text-dark/70">
                  {t('pageDescription')}
                </p>
              </div>

              <div className="mb-6">
                <div className="border-b border-border dark:border-border-dark">
                  <nav className="-mb-px flex gap-x-8">
                    {tabs.map((tab) => {
                      const IconComponent = tab.icon;
                      const isActive = activeTab === tab.id;

                      return (
                        <button
                          type="button"
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                            isActive
                              ? 'border-accent text-accent'
                              : 'border-transparent text-primary-text/60 hover:border-border hover:text-primary-text dark:text-primary-text-dark/60 dark:hover:border-border-dark dark:hover:text-primary-text-dark'
                          }`}
                        >
                          <IconComponent className="size-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>

              <div className="rounded-lg bg-surface dark:bg-surface-dark">
                {tabs.map((tab) => {
                  if (activeTab !== tab.id) return null;

                  const TabComponent = tab.component;
                  return (
                    <div key={tab.id} className="p-6">
                      <TabComponent key={apiKey} apiKey={apiKey} setToast={setToast} />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppShell>
  );
}
