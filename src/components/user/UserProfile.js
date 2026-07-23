'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { formatSize, SIZE_BASE_DECIMAL } from '@/components/downloads/utils/formatters';
import Spinner from '@/components/shared/Spinner';
import { AlertCircle, CheckCircle, User } from '@/components/icons';
import AirlockUsage from '@/components/user/AirlockUsage';
import BandwidthChart from '@/components/user/BandwidthChart';
import { useUserStats } from '@/hooks/useUserStats';
import { useSessionStore } from '@/store/sessionStore';
import { getPlanName as getPlanNameUtil } from '@/utils/userProfile';
import { buildTorboxSubscriptionReferralUrl } from '@/utils/referralLinks';
import UserProfileHeader from '@/components/user/UserProfileHeader';
import UserProfileBasicInfo from '@/components/user/UserProfileBasicInfo';
import {
  UserProfileAccountStatus,
  UserProfileUsageStats,
  UserProfileDownloadBreakdown,
} from '@/components/user/UserProfileCards';

export default function UserProfile({ apiKey, setToast }) {
  const t = useTranslations('User');
  const locale = useLocale();
  const [copiedLink, setCopiedLink] = useState(false);
  const [bandwidthGrouping, setBandwidthGrouping] = useState('week');
  const { userData, loading, error, loadPermissions } = useSessionStore(
    useShallow((state) => ({
      userData: state.userData,
      loading: state.permissionsLoading,
      error:
        !state.permissionsLoading && state.apiKey && !state.userData
          ? 'Failed to fetch user profile'
          : null,
      loadPermissions: state.loadPermissions,
    }))
  );
  const {
    general: statsGeneral,
    bandwidth: statsBandwidth,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useUserStats(apiKey, bandwidthGrouping);

  const retryProfileLoad = async () => {
    if (!apiKey) return;
    const permissions = await loadPermissions(apiKey);
    if (!permissions && setToast) {
      setToast({
        message: 'Failed to fetch user profile',
        type: 'error',
      });
    }
  };

  const copyReferralLink = async () => {
    if (!userData?.user_referral) return;

    const referralLink = buildTorboxSubscriptionReferralUrl(userData.user_referral);

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
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTransferBytes = (bytes) => formatSize(bytes ?? 0, locale, SIZE_BASE_DECIMAL);

  const getPlanName = (planId) => getPlanNameUtil(planId, t);

  const getStatusDisplay = (profile) => {
    if (profile.plan > 0) {
      const expiryDate = new Date(profile.premium_expires_at);
      const now = new Date();
      if (expiryDate > now) {
        return {
          status: t('status.active'),
          color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          icon: CheckCircle,
        };
      }
      return {
        status: t('status.expired'),
        color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        icon: AlertCircle,
      };
    }
    return {
      status: t('status.free'),
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      icon: User,
    };
  };

  try {
    if (!apiKey) {
      return (
        <div className="p-6">
          <div className="text-center py-12">
            <User className="size-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('noData')}</p>
          </div>
        </div>
      );
    }

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
            <AlertCircle className="size-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
            <p className="text-primary-text dark:text-primary-text-dark text-lg mb-2 font-medium">
              {t('errors.loadError') || 'Error loading profile'}
            </p>
            <p className="text-muted dark:text-muted-dark mb-6">{error}</p>
            <button
              type="button"
              onClick={retryProfileLoad}
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
            <User className="size-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('noData')}</p>
          </div>
        </div>
      );
    }

    const statusInfo = getStatusDisplay(userData);
    const StatusIcon = statusInfo.icon;

    return (
      <div className="space-y-6">
        <UserProfileHeader
          userData={userData}
          statusInfo={statusInfo}
          StatusIcon={StatusIcon}
          userIdLabel={t('profile.userId')}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UserProfileBasicInfo
            userData={userData}
            t={t}
            copiedLink={copiedLink}
            onCopyReferralLink={copyReferralLink}
            formatDate={formatDate}
          />
          <UserProfileAccountStatus
            userData={userData}
            t={t}
            getPlanName={getPlanName}
            formatDate={formatDate}
          />
          <UserProfileUsageStats
            userData={userData}
            t={t}
            formatTransferBytes={formatTransferBytes}
          />
          <UserProfileDownloadBreakdown userData={userData} t={t} />
        </div>

        <AirlockUsage
          usedBytes={statsGeneral?.airlocked_downloads ?? 0}
          limitBytes={statsGeneral?.airlock_storage_limit ?? 0}
          loading={statsLoading && statsGeneral == null}
          error={statsError}
          onRetry={refetchStats}
        />
        <BandwidthChart
          bandwidthData={statsBandwidth}
          grouping={bandwidthGrouping}
          onGroupingChange={setBandwidthGrouping}
          loading={statsLoading}
          error={statsError}
          onRetry={refetchStats}
        />
      </div>
    );
  } catch (err) {
    console.error('Error rendering UserProfile:', err);
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto text-center py-12">
          <AlertCircle className="size-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <p className="text-primary-text dark:text-primary-text-dark text-lg mb-2 font-medium">
            {t('errors.renderError') || 'Render Error'}
          </p>
          <p className="text-muted dark:text-muted-dark mb-6">{err.message}</p>
          <button
            type="button"
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
