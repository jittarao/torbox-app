'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApiHealth } from './hooks/useApiHealth';
import { useHealthStore } from '@/store/healthStore';
import { usePollingPauseStore } from '@/store/pollingPauseStore';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import SystemStatusPanel from '@/components/shared/SystemStatusPanel';
import Icons from '@/components/icons';

const HEALTH_CHECK_INTERVAL = 60000;

export default function SystemStatusIndicator({ apiKey, className = '' }) {
  const t = useTranslations('SystemStatus');
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const {
    overallStatus,
    lastCheck,
    error,
    refreshHealth,
    isLoading,
    platformHealth,
    connectionHealth,
    showBackend,
    platformHistory,
  } = useApiHealth(apiKey);
  const performHealthCheck = useHealthStore((state) => state.performHealthCheck);
  const isPollingPaused = usePollingPauseStore((state) => state.isPollingPaused);
  const pollingPaused = usePollingPauseStore((state) =>
    Object.values(state.pauseReasons).some((isPaused) => isPaused === true)
  );
  const refreshOnOpenRef = useRef(false);

  useEffect(() => {
    performHealthCheck(apiKey);

    const interval = setInterval(() => {
      if (isPollingPaused()) return;
      performHealthCheck(apiKey);
    }, HEALTH_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [apiKey, performHealthCheck, pollingPaused, isPollingPaused]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const statusConfig = {
    healthy: {
      icon: Icons.CheckCircle,
      iconClass: 'text-emerald-500 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
      label: t('status.healthy'),
      description: t('status.healthyDescription'),
    },
    'invalid-key': {
      icon: Icons.Key,
      iconClass: 'text-red-500 dark:text-red-400',
      dotClass: 'bg-red-500',
      label: t('status.invalidKey'),
      description: t('status.invalidKeyDescription'),
    },
    'api-unhealthy': {
      icon: Icons.ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.apiUnhealthy'),
      description: t('status.apiUnhealthyDescription'),
    },
    'platform-unhealthy': {
      icon: Icons.ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.platformUnhealthy'),
      description: t('status.platformUnhealthyDescription'),
    },
    'backend-unhealthy': {
      icon: Icons.ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.backendUnhealthy'),
      description: t('status.backendUnhealthyDescription'),
    },
    'no-api-key': {
      icon: Icons.Key,
      iconClass: 'text-zinc-400',
      dotClass: 'bg-zinc-500',
      label: t('status.noApiKey'),
      description: t('status.noApiKeyDescription'),
    },
    unknown: {
      icon: Icons.QuestionMarkCircle,
      iconClass: 'text-zinc-400',
      dotClass: 'bg-zinc-500',
      label: t('status.unknown'),
      description: t('status.unknownDescription'),
    },
  };

  const config = statusConfig[overallStatus] || statusConfig.unknown;
  const IconComponent = config.icon;

  const handleToggle = useCallback(() => {
    setIsOpen((open) => {
      if (!open) {
        refreshOnOpenRef.current = true;
      }
      return !open;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || !refreshOnOpenRef.current) return;
    refreshOnOpenRef.current = false;
    performHealthCheck(apiKey);
  }, [isOpen, apiKey, performHealthCheck]);

  const panelProps = {
    apiKey,
    config,
    overallStatus,
    lastCheck,
    error,
    platformHealth,
    connectionHealth,
    showBackend,
    platformHistory,
    onRefresh: refreshHealth,
  };

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`ui-dropdown-icon-btn ${isLoading ? 'animate-pulse' : ''}`}
        aria-label={t('refreshStatus')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {isLoading ? (
          <span className="h-4 w-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        ) : (
          <IconComponent className={`h-5 w-5 ${config.iconClass}`} />
        )}
      </button>

      <HeaderOverlayPortal open={isOpen}>
        <div className="md:hidden">
          <div
            className="fixed inset-0 z-[200] bg-black/60"
            onClick={() => setIsOpen(false)}
            aria-hidden
          />
          <div className="fixed inset-0 z-[201] flex items-end sm:items-center justify-center p-3 sm:p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-sm max-h-[min(90vh,32rem)] flex flex-col overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-2xl dark:border-zinc-600 dark:bg-[#242428]"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-y-auto overflow-x-hidden min-h-0 flex-1">
                <SystemStatusPanel {...panelProps} />
              </div>
            </div>
          </div>
        </div>
      </HeaderOverlayPortal>

      <HeaderDropdownPanel
        open={isOpen}
        widthClass="w-[min(20rem,calc(100vw-2rem))]"
        className="!py-0 hidden md:flex md:flex-col max-h-[min(32rem,calc(100vh-5rem))] overflow-hidden"
      >
        <div className="overflow-y-auto overflow-x-hidden min-h-0">
          <SystemStatusPanel {...panelProps} />
        </div>
      </HeaderDropdownPanel>
    </div>
  );
}
