'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';

export default function UserSubscriptions({ apiKey, setToast }) {
  const t = useTranslations('User');
  const [subscriptions, setSubscriptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    fetchSubscriptions();
  }, [apiKey]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/subscriptions', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setSubscriptions(data.data);
      } else {
        const errorMessage = data.error || data.detail || 'Failed to fetch subscriptions';
        setError(errorMessage);
        if (setToast) {
          setToast({
            message: errorMessage,
            type: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      const errorMessage = err.message || 'Failed to fetch subscriptions';
      setError(errorMessage);
      if (setToast) {
        setToast({
          message: errorMessage,
          type: 'error',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (err) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (amount === null || amount === undefined) return 'N/A';
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    } catch (err) {
      return 'N/A';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'expired':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'pending':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={fetchSubscriptions}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  // Wrap the entire render in try-catch to prevent crashes
  try {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-text dark:text-text-dark mb-4">
            {t('subscriptions.title')}
          </h2>
        </div>

        {subscriptions && subscriptions.length > 0 ? (
          <div className="space-y-6">
            {subscriptions.map((subscription, index) => (
              <div
                key={subscription.id || index}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-border dark:border-border-dark"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-text dark:text-text-dark">
                      {subscription.plan_name || t('subscriptions.unknownPlan')}
                    </h3>
                    <p className="text-sm text-muted dark:text-muted-dark">
                      {subscription.plan_description || t('subscriptions.noDescription')}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                    {subscription.status || 'unknown'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.planId')}</p>
                    <p className="font-medium text-text dark:text-text-dark">{subscription.plan_id || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.price')}</p>
                    <p className="font-medium text-text dark:text-text-dark">
                      {formatCurrency(subscription.price, subscription.currency)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.billingCycle')}</p>
                    <p className="font-medium text-text dark:text-text-dark">
                      {subscription.billing_cycle || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.startDate')}</p>
                    <p className="font-medium text-text dark:text-text-dark">
                      {formatDate(subscription.start_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.endDate')}</p>
                    <p className="font-medium text-text dark:text-text-dark">
                      {formatDate(subscription.end_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted dark:text-muted-dark">{t('subscriptions.autoRenew')}</p>
                    <p className="font-medium text-text dark:text-text-dark">
                      {subscription.auto_renew ? t('subscriptions.yes') : t('subscriptions.no')}
                    </p>
                  </div>
                </div>

                {subscription.features && subscription.features.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-muted dark:text-muted-dark mb-2">{t('subscriptions.features')}</p>
                    <div className="flex flex-wrap gap-2">
                      {subscription.features.map((feature, featureIndex) => (
                        <span
                          key={featureIndex}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Icons.CreditCard className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('subscriptions.noSubscriptions')}</p>
          </div>
        )}
      </div>
    );
  } catch (err) {
    console.error('Error rendering UserSubscriptions:', err);
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">An error occurred while rendering subscriptions</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
