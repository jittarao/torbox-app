'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import AppShell from '@/components/navigation/AppShell';
import UserProfile from '@/components/user/UserProfile';
import ReferralUpgradeCard from '@/components/referral/ReferralUpgradeCard';
import Toast from '@/components/shared/Toast';
import { useSession } from '@/components/shared/hooks/useSession';

export default function UserPageClient() {
  const [toast, setToast] = useState(null);
  const { apiKey, hydrated, setApiKey } = useSession();
  const t = useTranslations('User');

  useEffect(() => {
    if (apiKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(apiKey).catch((error) => {
          console.error('Error ensuring user database on load:', error);
        });
      });
    }
  }, [apiKey]);

  const handleKeyChange = (newKey) => {
    setApiKey(newKey);
    if (newKey) {
      import('@/utils/ensureUserDb').then(({ ensureUserDb }) => {
        ensureUserDb(newKey).catch((error) => {
          console.error('Error ensuring user database:', error);
        });
      });
    }
  };

  if (!hydrated) {
    return <div className={`min-h-dvh bg-surface dark:bg-surface-dark font-sans`}></div>;
  }

  return (
    <AppShell apiKey={apiKey} className={`min-h-dvh bg-surface dark:bg-surface-dark font-sans`}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text dark:text-text-dark mb-2">{t('title')}</h1>
          <p className="text-muted dark:text-muted-dark">{t('description')}</p>
        </div>

        {/* User Profile Content */}
        <div>
          <ErrorBoundary>
            <ReferralUpgradeCard apiKey={apiKey} onToast={setToast} />
            <UserProfile apiKey={apiKey} setToast={setToast} />
          </ErrorBoundary>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AppShell>
  );
}

// Simple Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('Error in user page component:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="text-center py-8">
            <div className="size-12 text-red-500 mx-auto mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-red-600 dark:text-red-400 mb-4">
              Something went wrong with this component
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
