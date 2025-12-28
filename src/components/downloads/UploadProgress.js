'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

function formatTime(ms) {
  if (!ms || ms <= 0) return null;
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export default function UploadProgress({ progress, uploading, rateLimitInfo }) {
  const t = useTranslations('UploadProgress');
  const [currentWaitTime, setCurrentWaitTime] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);

  // Update wait time countdown
  useEffect(() => {
    if (!rateLimitInfo?.waitTimeMs || rateLimitInfo.waitTimeMs <= 0) {
      setCurrentWaitTime(0);
      return;
    }

    setCurrentWaitTime(rateLimitInfo.waitTimeMs);
    const interval = setInterval(() => {
      setCurrentWaitTime((prev) => {
        const newTime = Math.max(0, prev - 1000);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitInfo?.waitTimeMs]);

  // Update estimated completion time
  useEffect(() => {
    if (!rateLimitInfo?.estimatedCompletionTime) {
      setEstimatedTime(null);
      return;
    }

    const updateEstimated = () => {
      const now = Date.now();
      const remaining = Math.max(0, rateLimitInfo.estimatedCompletionTime - now);
      setEstimatedTime(remaining);
    };

    updateEstimated();
    const interval = setInterval(updateEstimated, 1000);

    return () => clearInterval(interval);
  }, [rateLimitInfo?.estimatedCompletionTime]);

  if (!uploading && !rateLimitInfo?.isRateLimited) return null;

  const current = progress?.current || 0;
  const total = progress?.total || 0;
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const remaining = total - current;

  const uploadsInMinute = rateLimitInfo?.uploadsInLastMinute?.length || 0;
  const uploadsInHour = rateLimitInfo?.uploadsInLastHour?.length || 0;
  const isNearLimit = uploadsInMinute >= 8 || uploadsInHour >= 55;

  return (
    <div className="mt-4 space-y-2">
      {/* Progress bar */}
      <div className="w-full bg-surface-alt dark:bg-surface-alt-dark rounded-full overflow-hidden">
        <div
          className="bg-accent dark:bg-accent-dark rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {/* Progress text */}
      <div className="text-center text-sm text-primary-text/70 dark:text-primary-text-dark/70">
        {uploading ? (
          <>
            {t('uploading', { current, total })}
            {remaining > 0 && (
              <span className="ml-2 text-xs">
                {t('remaining', { remaining })}
              </span>
            )}
          </>
        ) : (
          <span>{t('preparingUploads')}</span>
        )}
      </div>

      {/* Rate limit info */}
      {(rateLimitInfo?.isRateLimited || currentWaitTime > 0 || isNearLimit) && (
        <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 text-xs text-yellow-700 dark:text-yellow-300">
              {currentWaitTime > 0 ? (
                <p>
                  <span className="font-medium">{t('rateLimit')}</span> {t('waitingBeforeNext', { time: formatTime(currentWaitTime) })}
                </p>
              ) : isNearLimit ? (
                <p>
                  <span className="font-medium">{t('approachingRateLimit')}</span> {t('approachingRateLimitDetails', { perMinute: uploadsInMinute, perHour: uploadsInHour })}
                </p>
              ) : (
                <p>
                  <span className="font-medium">{t('rateLimitActive')}</span> {t('pleaseWait')}
                </p>
              )}
              {estimatedTime && estimatedTime > 0 && (
                <p className="mt-1">
                  {t('estimatedCompletion')} {formatTime(estimatedTime)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
