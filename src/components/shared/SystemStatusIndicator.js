'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useApiHealth } from './hooks/useApiHealth';
import { useHealthStore } from '@/store/healthStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import Icons from '@/components/icons';

const HEALTH_CHECK_INTERVAL = 60000; // 60 seconds

export default function SystemStatusIndicator({ apiKey, className = '' }) {
  const t = useTranslations('SystemStatus');
  const [showTooltip, setShowTooltip] = useState(false);
  const { overallStatus, lastCheck, error, refreshHealth, isLoading } = useApiHealth(apiKey);
  const { performHealthCheck } = useHealthStore();
  // Subscribe to pause reasons to trigger re-render when pause state changes
  const pauseReasons = usePollingPauseStore((state) => state.pauseReasons);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);

  // Start health checks once when component mounts
  useEffect(() => {
    if (apiKey) {
      // Perform initial health check
      performHealthCheck(apiKey);

      // Set up periodic health checks
      const interval = setInterval(() => {
        // Check if polling is paused (e.g., video player is open)
        if (isPollingPaused()) {
          return;
        }
        performHealthCheck(apiKey);
      }, HEALTH_CHECK_INTERVAL);

      return () => {
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, performHealthCheck, pauseReasons]);

  // Status configuration
  const statusConfig = {
    healthy: {
      color: 'bg-green-500',
      borderColor: 'border-green-500',
      textColor: 'text-green-500',
      icon: Icons.CheckCircle,
      label: t('status.healthy'),
      description: t('status.healthyDescription')
    },
    'api-unhealthy': {
      color: 'bg-yellow-500',
      borderColor: 'border-yellow-500',
      textColor: 'text-yellow-500',
      icon: Icons.ExclamationTriangle,
      label: t('status.apiUnhealthy'),
      description: t('status.apiUnhealthyDescription')
    },
    'no-api-key': {
      color: 'bg-gray-400',
      borderColor: 'border-gray-400',
      textColor: 'text-gray-400',
      icon: Icons.Key,
      label: t('status.noApiKey'),
      description: t('status.noApiKeyDescription')
    },
    unhealthy: {
      color: 'bg-red-500',
      borderColor: 'border-red-500',
      textColor: 'text-red-500',
      icon: Icons.XCircle,
      label: t('status.unhealthy'),
      description: t('status.unhealthyDescription')
    },
    unknown: {
      color: 'bg-gray-400',
      borderColor: 'border-gray-400',
      textColor: 'text-gray-400',
      icon: Icons.QuestionMarkCircle,
      label: t('status.unknown'),
      description: t('status.unknownDescription')
    }
  };

  const config = statusConfig[overallStatus] || statusConfig.unknown;
  const IconComponent = config.icon;

  const formatLastCheck = (date) => {
    if (!date) return t('never');
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (seconds < 60) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { minutes });
    return t('hoursAgo', { hours: Math.floor(minutes / 60) });
  };

  return (
    <div className={`relative ${className}`}>
      {/* Status indicator */}
      <button
        onClick={refreshHealth}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          relative flex items-center justify-center w-6 h-6
          hover:opacity-80 transition-opacity duration-200
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          ${isLoading ? 'animate-pulse' : ''}
        `}
        aria-label={t('refreshStatus')}
        disabled={isLoading}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-300 border-t-transparent rounded-full animate-spin" />
        ) : (
          <IconComponent className={`w-4 h-4 ${config.textColor}`} />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="flex items-start space-x-2">
            <div className={`flex-shrink-0 w-3 h-3 rounded-full ${config.color}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {config.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {config.description}
              </p>
              {error && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {t('error')}: {error}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {t('lastCheck')}: {formatLastCheck(lastCheck)}
              </p>
              

            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-200 dark:border-b-gray-700" />
        </div>
      )}
    </div>
  );
}
