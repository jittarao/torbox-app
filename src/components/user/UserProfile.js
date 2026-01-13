'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';
import { getPlanName as getPlanNameUtil } from '@/utils/userProfile';

export default function UserProfile({ apiKey, setToast }) {
  const t = useTranslations('User');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const fetchingRef = useRef(false);

  const fetchUserProfile = useCallback(async () => {
    // Prevent duplicate calls
    if (fetchingRef.current) {
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const { fetchUserProfile: fetchProfile } = await import('@/utils/userProfile');
      const profileData = await fetchProfile(apiKey);
      
      if (profileData) {
        setUserData(profileData);
      } else {
        const errorMessage = 'Failed to fetch user profile';
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
      fetchingRef.current = false;
    }
  }, [apiKey, setToast]);

  useEffect(() => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    fetchUserProfile();
  }, [apiKey, fetchUserProfile]);

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
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
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
    return getPlanNameUtil(planId, t);
  };

  const getStatusDisplay = (userData) => {
    // Check if user has a premium plan and it's not expired
    if (userData.plan > 0) {
      const expiryDate = new Date(userData.premium_expires_at);
      const now = new Date();
      if (expiryDate > now) {
        return { 
          status: t('status.active'), 
          color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          icon: Icons.CheckCircle 
        };
      } else {
        return { 
          status: t('status.expired'), 
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          icon: Icons.AlertCircle 
        };
      }
    } else {
      return { 
        status: t('status.free'), 
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        icon: Icons.User 
      };
    }
  };

  // Wrap the entire render in try-catch to prevent crashes
  try {
    if (loading) {
      return (
        <div className="p-6">
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <div className="max-w-md mx-auto text-center py-12">
            <Icons.AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-primary-text dark:text-primary-text-dark text-lg mb-2 font-medium">{t('errors.loadError') || 'Error loading profile'}</p>
            <p className="text-muted dark:text-muted-dark mb-6">{error}</p>
            <button
              onClick={fetchUserProfile}
              className="px-6 py-2.5 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
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
          <div className="text-center py-12">
            <Icons.User className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('noData')}</p>
          </div>
        </div>
      );
    }

    const statusInfo = getStatusDisplay(userData);
    const StatusIcon = statusInfo.icon;

    return (
      <div className="space-y-6">
        {/* Header Card with Status */}
        <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 dark:bg-accent-dark/10 flex items-center justify-center">
                <Icons.User className="w-8 h-8 text-accent dark:text-accent-dark" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-primary-text dark:text-primary-text-dark mb-1">
                  {userData.email || 'User Profile'}
                </h2>
                <p className="text-sm text-muted dark:text-muted-dark">
                  {t('profile.userId')}: {userData.id || 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {StatusIcon && <StatusIcon className="w-5 h-5" />}
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
                {statusInfo.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information Card */}
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Icons.User className="w-5 h-5 text-accent dark:text-accent-dark" />
              <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                {t('profile.basicInfo')}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.email')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-medium break-all">{userData.email || 'N/A'}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.referralCode')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-medium font-mono text-sm">{userData.user_referral || 'N/A'}</span>
              </div>
              
              {/* Referral Link */}
              {userData.user_referral && (
                <div className="pt-2 border-t border-border dark:border-border-dark">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm text-muted dark:text-muted-dark">{t('referralLink')}</span>
                    <div className="flex items-center gap-2 p-3 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
                      <span className="text-primary-text dark:text-primary-text-dark font-mono text-xs break-all flex-1">
                        https://torbox.app/subscription?referral={userData.user_referral}
                      </span>
                      <button
                        onClick={copyReferralLink}
                        className="p-2 text-accent dark:text-accent-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded transition-colors flex-shrink-0"
                        title={t('copyLink')}
                        aria-label={t('copyLink')}
                      >
                        {copiedLink ? (
                          <Icons.Check className="w-5 h-5" />
                        ) : (
                          <Icons.Copy className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.createdAt')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-medium">{formatDate(userData.created_at)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.lastLogin')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-medium">{formatDate(userData.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Account Status Card */}
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Icons.CreditCard className="w-5 h-5 text-accent dark:text-accent-dark" />
              <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                {t('profile.accountStatus')}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.plan')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{getPlanName(userData.plan)}</span>
              </div>
              
              {userData.plan > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-sm text-muted dark:text-muted-dark">{t('profile.planExpiry')}</span>
                  <span className="text-primary-text dark:text-primary-text-dark font-medium">{formatDate(userData.premium_expires_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Usage Statistics Card */}
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Icons.BarChart3 className="w-5 h-5 text-accent dark:text-accent-dark" />
              <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                {t('profile.usage')}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.totalDownloads')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold text-lg">{userData.total_downloaded || 0}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.totalSize')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{formatBytes(userData.total_bytes_downloaded || 0)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.totalUploaded')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{formatBytes(userData.total_bytes_uploaded || 0)}</span>
              </div>
              
              {/* Ratio Calculation */}
              <div className="pt-2 border-t border-border dark:border-border-dark">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-sm text-muted dark:text-muted-dark">{t('profile.ratio')}</span>
                  <span className="text-primary-text dark:text-primary-text-dark font-semibold text-lg">
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
          </div>

          {/* Download Breakdown Card */}
          <div className="bg-surface dark:bg-surface-dark rounded-lg border border-border dark:border-border-dark p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Icons.Download className="w-5 h-5 text-accent dark:text-accent-dark" />
              <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                {t('profile.downloadBreakdown')}
              </h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.torrentDownloads')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{userData.torrents_downloaded || 0}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.webDownloads')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{userData.web_downloads_downloaded || 0}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-sm text-muted dark:text-muted-dark">{t('profile.usenetDownloads')}</span>
                <span className="text-primary-text dark:text-primary-text-dark font-semibold">{userData.usenet_downloads_downloaded || 0}</span>
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
        <div className="max-w-md mx-auto text-center py-12">
          <Icons.AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <p className="text-primary-text dark:text-primary-text-dark text-lg mb-2 font-medium">{t('errors.renderError') || 'Render Error'}</p>
          <p className="text-muted dark:text-muted-dark mb-6">{err.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-accent dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            {t('errors.reloadPage') || 'Reload Page'}
          </button>
        </div>
      </div>
    );
  }
}
