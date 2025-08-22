'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import Icons from '@/components/icons';

export default function UserStats({ apiKey, setToast }) {
  const t = useTranslations('User');
  const [statsData, setStatsData] = useState(null);
  const [stats30Days, setStats30Days] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!apiKey) {
      setError('API key is required');
      return;
    }

    fetchStats();
  }, [apiKey]);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch both general stats and 30-day stats in parallel
      const [generalResponse, days30Response] = await Promise.all([
        fetch('/api/stats', {
          headers: {
            'x-api-key': apiKey,
          },
        }),
        fetch('/api/stats/30days', {
          headers: {
            'x-api-key': apiKey,
          },
        }),
      ]);

      const [generalData, days30Data] = await Promise.all([
        generalResponse.json().catch(() => ({ success: false, error: 'Failed to parse general stats' })),
        days30Response.json().catch(() => ({ success: false, error: 'Failed to parse 30-day stats' })),
      ]);

      if (generalData.success) {
        setStatsData(generalData.data);
      }

      if (days30Data.success) {
        setStats30Days(days30Data.data);
      }

      if (!generalData.success && !days30Data.success) {
        const errorMsg = generalData.error || days30Data.error || 'Failed to fetch stats';
        setError(errorMsg);
        if (setToast) {
          setToast({
            message: errorMsg,
            type: 'error',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      const errorMessage = err.message || 'Failed to fetch statistics';
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

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
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
            onClick={fetchStats}
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
            {t('stats.title')}
          </h2>
        </div>

        {/* General Statistics */}
        {statsData && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-text dark:text-text-dark mb-4 border-b border-border dark:border-border-dark pb-2">
              {t('stats.general')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Icons.Download className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{t('stats.totalDownloads')}</p>
                    <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                      {formatNumber(statsData.total_downloads)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Icons.HardDrive className="w-8 h-8 text-green-600 dark:text-green-400 mr-3" />
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">{t('stats.totalSize')}</p>
                    <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                      {formatBytes(statsData.total_size)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Icons.Activity className="w-8 h-8 text-purple-600 dark:text-purple-400 mr-3" />
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">{t('stats.activeDownloads')}</p>
                    <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                      {formatNumber(statsData.active_downloads)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div className="flex items-center">
                  <Icons.Clock className="w-8 h-8 text-orange-600 dark:text-orange-400 mr-3" />
                  <div>
                    <p className="text-sm text-orange-600 dark:text-orange-400">{t('stats.avgSpeed')}</p>
                    <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                      {formatBytes(statsData.avg_speed || 0)}/s
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 30-Day Statistics */}
        {stats30Days && (
          <div className="mb-8">
            <h3 className="text-lg font-medium text-text dark:text-text-dark mb-4 border-b border-border dark:border-border-dark pb-2">
              {t('stats.last30Days')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <h4 className="font-medium text-text dark:text-text-dark">{t('stats.downloads')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.torrents')}:</span>
                    <span className="font-medium">{formatNumber(stats30Days.torrent_downloads || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.usenet')}:</span>
                    <span className="font-medium">{formatNumber(stats30Days.usenet_downloads || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.webdl')}:</span>
                    <span className="font-medium">{formatNumber(stats30Days.webdl_downloads || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-text dark:text-text-dark">{t('stats.dataUsage')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.torrents')}:</span>
                    <span className="font-medium">{formatBytes(stats30Days.torrent_size || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.usenet')}:</span>
                    <span className="font-medium">{formatBytes(stats30Days.usenet_size || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.webdl')}:</span>
                    <span className="font-medium">{formatBytes(stats30Days.webdl_size || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-text dark:text-text-dark">{t('stats.performance')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.avgSpeed')}:</span>
                    <span className="font-medium">{formatBytes(stats30Days.avg_speed || 0)}/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.peakSpeed')}:</span>
                    <span className="font-medium">{formatBytes(stats30Days.peak_speed || 0)}/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted dark:text-muted-dark">{t('stats.successRate')}:</span>
                    <span className="font-medium">{((stats30Days.success_rate || 0) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!statsData && !stats30Days && !loading && !error && (
          <div className="text-center py-8">
            <Icons.BarChart3 className="w-12 h-12 text-muted dark:text-muted-dark mx-auto mb-4" />
            <p className="text-muted dark:text-muted-dark">{t('stats.noData')}</p>
          </div>
        )}
      </div>
    );
  } catch (err) {
    console.error('Error rendering UserStats:', err);
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <Icons.AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 dark:text-red-400">An error occurred while rendering statistics</p>
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
