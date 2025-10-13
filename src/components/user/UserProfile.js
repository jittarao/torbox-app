'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';

export default function UserProfile({ apiKey, setToast }) {
  const t = useTranslations('User');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    fetchUserProfile();
  }, [apiKey]);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);

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

      if (data.success) {
        setUserData(data.data);
      } else {
        const errorMessage = data.error || data.detail || 'Failed to fetch user profile';
        setError(errorMessage);
        if (setToast) {
          setToast({
            message: errorMessage,
            type: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      const errorMessage = err.message || 'Failed to fetch user profile';
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

  const copyReferralLink = async () => {
    if (!userData?.user_referral) return;
    
    const referralLink = `https://torbox.app/subscription?referral=${userData.user_referral}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      
      if (setToast) {
        setToast({
          message: t('copyLink'),
          type: 'success',
        });
      }
    } catch (err) {
      console.error('Failed to copy referral link:', err);
      if (setToast) {
        setToast({
          message: t('copyLinkFailed'),
          type: 'error',
        });
      }
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    try {
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (err) {
      return '0 B';
    }
  };

  const getPlanName = (planId) => {
    switch (planId) {
      case 0: return t('plans.free');
      case 1: return t('plans.essential');
      case 2: return t('plans.pro');
      case 3: return t('plans.standard');
      default: return t('plans.unknown');
    }
  };

  const getStatusDisplay = (userData) => {
    // Check if user has a premium plan and it's not expired
    if (userData.plan > 0) {
      const expiryDate = new Date(userData.premium_expires_at);
      const now = new Date();
      if (expiryDate > now) {
        return { status: t('status.active'), color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
      } else {
        return { status: t('status.expired'), color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
      }
    } else {
      return { status: t('status.free'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
    }
  };

  // Wrap the entire render in try-catch to prevent crashes
  try {
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
              onClick={fetchUserProfile}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
            >
              {t('retry')}
            </button>
          </div>
        </div>
      );
    }

    if (!userData) {
      return (
        <div className="p-6">
          <div className="text-center py-8">
            <p className="text-muted dark:text-muted-dark">{t('noData')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text dark:text-text-dark border-b border-border dark:border-border-dark pb-2">
              {t('profile.basicInfo')}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.email')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.email || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.userId')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.id || 'N/A'}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.referralCode')}:</span>
                <span className="text-text dark:text-text-dark font-medium font-mono text-sm">{userData.user_referral || 'N/A'}</span>
              </div>
              
              {/* Referral Link */}
              {userData.user_referral && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <span className="text-muted dark:text-muted-dark">{t('referralLink')}:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-text dark:text-text-dark font-medium font-mono text-sm break-all">
                      https://torbox.app/subscription?referral={userData.user_referral}
                    </span>
                    <button
                      onClick={copyReferralLink}
                      className="p-1 text-accent dark:text-accent-dark hover:bg-accent/5 dark:hover:bg-accent-dark/5 rounded transition-colors flex-shrink-0"
                      title={t('copyLink')}
                    >
                      {copiedLink ? (
                        <Icons.Check className="w-4 h-4" />
                      ) : (
                        <Icons.Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.createdAt')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{formatDate(userData.created_at)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.lastLogin')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{formatDate(userData.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Account Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text dark:text-text-dark border-b border-border dark:border-border-dark pb-2">
              {t('profile.accountStatus')}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.status')}:</span>
                {(() => {
                  const statusInfo = getStatusDisplay(userData);
                  return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.status}
                    </span>
                  );
                })()}
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.plan')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{getPlanName(userData.plan)}</span>
              </div>
              
              {userData.plan > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted dark:text-muted-dark">{t('profile.planExpiry')}:</span>
                  <span className="text-text dark:text-text-dark font-medium">{formatDate(userData.premium_expires_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text dark:text-text-dark border-b border-border dark:border-border-dark pb-2">
              {t('profile.usage')}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.totalDownloads')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.total_downloaded || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.totalSize')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{formatBytes(userData.total_bytes_downloaded || 0)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.totalUploaded')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{formatBytes(userData.total_bytes_uploaded || 0)}</span>
              </div>
              
              {/* Ratio Calculation */}
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Ratio:</span>
                <span className="text-text dark:text-text-dark font-medium">
                  {(() => {
                    const downloaded = userData.total_bytes_downloaded || 0;
                    const uploaded = userData.total_bytes_uploaded || 0;
                    if (downloaded === 0) return '∞';
                    const ratio = uploaded / downloaded;
                    return ratio.toFixed(2);
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Download Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-text dark:text-text-dark border-b border-border dark:border-border-dark pb-2">
              {t('profile.downloadBreakdown')}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.torrentDownloads')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.torrents_downloaded || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.webDownloads')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.web_downloads_downloaded || 0}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">{t('profile.usenetDownloads')}:</span>
                <span className="text-text dark:text-text-dark font-medium">{userData.usenet_downloads_downloaded || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error('Error rendering UserProfile:', err);
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">{t('errors.renderError')}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors"
          >
            {t('errors.reloadPage')}
          </button>
        </div>
      </div>
    );
  }
}
