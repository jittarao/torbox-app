'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApiHealth } from './hooks/useApiHealth';
import { useHealthStore } from '@/store/healthStore';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import SystemStatusPanel from '@/components/shared/SystemStatusPanel';
import Icons from '@/components/icons';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';
import useIsMobile from '@/hooks/useIsMobile';

export default function SystemStatusIndicator({ apiKey, className = '' }) {
  const t = useTranslations('SystemStatus');
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const isMobile = useIsMobile();
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
  const startHealthPolling = useHealthStore((state) => state.startHealthPolling);
  const stopHealthPolling = useHealthStore((state) => state.stopHealthPolling);
  const performHealthCheck = useHealthStore((state) => state.performHealthCheck);
  const refreshOnOpenRef = useRef(false);

  useEffect(() => {
    startHealthPolling(apiKey);
    return () => stopHealthPolling();
  }, [apiKey, startHealthPolling, stopHealthPolling]);

  const closePanel = useCallback(() => setIsOpen(false), []);
  useHeaderDropdownDismiss({ isOpen, onClose: closePanel, anchorRef: rootRef });

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

      {isMobile ? (
        <HeaderOverlayPortal open={isOpen}>
          <div data-header-overlay>
            <div
              className="z-overlay-backdrop fixed inset-0 bg-black/60"
              onClick={closePanel}
              aria-hidden
            />
            <div className="z-overlay-panel fixed inset-0 flex items-end justify-center p-3 sm:items-center sm:p-4 pointer-events-none">
              <div
                className="pointer-events-auto w-full max-w-sm max-h-[min(90vh,32rem)] flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-alt-dark"
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
      ) : (
        <HeaderDropdownPanel
          open={isOpen}
          placement="sidebar"
          widthClass="w-[min(20rem,calc(100vw-2rem))]"
          className="!py-0 flex flex-col max-h-[min(32rem,calc(100vh-1.5rem))] overflow-hidden"
        >
          <div className="overflow-y-auto overflow-x-hidden min-h-0">
            <SystemStatusPanel {...panelProps} />
          </div>
        </HeaderDropdownPanel>
      )}
    </div>
  );
}
