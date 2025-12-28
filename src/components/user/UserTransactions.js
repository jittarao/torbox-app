'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';

export default function UserTransactions({ apiKey, setToast }) {
  const t = useTranslations('User');
  const [transactions, setTransactions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    fetchTransactions();
  }, [apiKey]);

  const fetchTransactions = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/user/transactions', {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setTransactions(data.data);
      } else {
        const errorMessage = data.error || data.detail || 'Failed to fetch transactions';
        setError(errorMessage);
        if (setToast) {
          setToast({
            message: errorMessage,
            type: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      const errorMessage = err.message || 'Failed to fetch transactions';
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

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
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
      case 'completed':
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'refunded':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'subscription':
        return <Icons.CreditCard className="w-4 h-4" />;
      case 'payment':
        return <Icons.DollarSign className="w-4 h-4" />;
      case 'refund':
        return <Icons.RotateCcw className="w-4 h-4" />;
      case 'credit':
        return <Icons.Plus className="w-4 h-4" />;
      default:
        return <Icons.FileText className="w-4 h-4" />;
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
            onClick={fetchTransactions}
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
            {t('transactions.title')}
          </h2>
        </div>

        {transactions && transactions.length > 0 ? (
          <div className="space-y-4">
            {transactions.map((transaction, index) => (
              <div
                key={transaction.id || index}
                className="bg-white dark:bg-gray-800 border border-border dark:border-border-dark rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="text-muted dark:text-muted-dark">
                      {getTypeIcon(transaction.type)}
                    </div>
                    <div>
                      <h3 className="font-medium text-text dark:text-text-dark">
                        {transaction.description || t('transactions.noDescription')}
                      </h3>
                      <p className="text-sm text-muted dark:text-muted-dark">
                        {formatDateTime(transaction.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-text dark:text-text-dark">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status || 'unknown'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted dark:text-muted-dark">{t('transactions.transactionId')}: </span>
                    <span className="font-medium">{transaction.transaction_id || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted dark:text-muted-dark">{t('transactions.type')}: </span>
                    <span className="font-medium capitalize">{transaction.type || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted dark:text-muted-dark">{t('transactions.paymentMethod')}: </span>
                    <span className="font-medium">{transaction.payment_method || 'N/A'}</span>
                  </div>
                </div>

                {transaction.notes && (
                  <div className="mt-3 pt-3 border-t border-border dark:border-border-dark">
                    <p className="text-sm text-muted dark:text-muted-dark">
                      <span className="font-medium">{t('transactions.notes')}:</span> {transaction.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Icons.Receipt className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('transactions.noTransactions')}</p>
          </div>
        )}
      </div>
    );
  } catch (err) {
    console.error('Error rendering UserTransactions:', err);
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">An error occurred while rendering transactions</p>
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
