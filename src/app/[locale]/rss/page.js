'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Header from '@/components/Header';
import RssFeedManager from '@/components/rss/RssFeedManager';
import RssItemsManager from '@/components/rss/RssItemsManager';

import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export default function RssPage() {
  const [toast, setToast] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState('feeds');
  const [error, setError] = useState(null);
  const [userPlan, setUserPlan] = useState(null);
  const [checkingPlan, setCheckingPlan] = useState(false);

  // Move translations hook to top level - always call it
  const t = useTranslations('RssFeeds');

  useEffect(() => {
    try {
      setIsClient(true);

      // Load API key from storage (same as main page)
      const storedKey = localStorage.getItem('torboxApiKey');
      const storedKeys = localStorage.getItem('torboxApiKeys');

      let loadedKey = null;
      if (storedKey) {
        loadedKey = storedKey;
        setApiKey(storedKey);
      } else if (storedKeys) {
        // If no active key but we have stored keys, use the first one
        const keys = JSON.parse(storedKeys);
        if (keys.length > 0) {
          loadedKey = keys[0].key;
          setApiKey(keys[0].key);
          localStorage.setItem('torboxApiKey', keys[0].key);
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
    } catch (err) {
      console.error('Error in RSS page useEffect:', err);
      setError(err.message);
    }
  }, []);

  // Fetch user plan when apiKey is available
  useEffect(() => {
    if (!apiKey) {
      setUserPlan(null);
      return;
    }

    const fetchUserPlan = async () => {
      setCheckingPlan(true);
      try {
        const response = await fetch('/api/user/me', {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Response structure: { success: true, data: { plan: ... } }
        if (data.success && data.data) {
          setUserPlan(data.data.plan);
        } else {
          // If response doesn't have success/data structure, try direct access
          setUserPlan(data.plan || data.data?.plan || null);
        }
      } catch (err) {
        console.error('Error fetching user plan:', err);
        setUserPlan(null);
      } finally {
        setCheckingPlan(false);
      }
    };

    fetchUserPlan();
  }, [apiKey]);

  // Handle API key change
  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    localStorage.setItem('torboxApiKey', newKey);
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
  if (!isClient) {
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
      ) : checkingPlan ? (
        <>
          <Header apiKey={apiKey} />
          <div className="container mx-auto p-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-center">
                  <Spinner size="lg" />
                  <p className="mt-4 text-primary-text dark:text-primary-text-dark">
                    {t('checkingSubscription')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : userPlan !== 2 ? (
        <>
          <Header apiKey={apiKey} />
          <div className="container mx-auto p-4">
            <div className="max-w-6xl mx-auto">
              <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-center bg-surface-alt dark:bg-surface-alt-dark p-8 rounded-lg border border-border dark:border-border-dark max-w-md">
                  <Icons.ExclamationTriangle className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
                  <h2 className="text-2xl font-bold mb-4 text-primary-text dark:text-primary-text-dark">
                    {t('proSubscriptionRequired')}
                  </h2>
                  <p className="text-primary-text/70 dark:text-primary-text-dark/70">
                    {t('proUserRequired')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <Header apiKey={apiKey} />
          <div className="container mx-auto p-4">
            <div className="max-w-6xl mx-auto">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-primary-text dark:text-primary-text-dark mb-2">
                  {t('pageTitle')}
                </h1>
                <p className="text-primary-text/70 dark:text-primary-text-dark/70">
                  {t('pageDescription')}
                </p>
              </div>

              {/* Tabs */}
              <div className="mb-6">
                <div className="border-b border-border dark:border-border-dark">
                  <nav className="-mb-px flex space-x-8">
                    {tabs.map((tab) => {
                      const IconComponent = tab.icon;
                      const isActive = activeTab === tab.id;
                      
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                            isActive
                              ? 'border-accent text-accent'
                              : 'border-transparent text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary-text dark:hover:text-primary-text-dark hover:border-border dark:hover:border-border-dark'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {/* Tab Content */}
              <div className="bg-surface dark:bg-surface-dark rounded-lg">
                {tabs.map((tab) => {
                  if (activeTab !== tab.id) return null;
                  
                  const TabComponent = tab.component;
                  return (
                    <div key={tab.id} className="p-6">
                      <TabComponent apiKey={apiKey} setToast={setToast} />
                    </div>
                  );
                })}
              </div>
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
