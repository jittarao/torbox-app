'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useApiHealth } from './hooks/useApiHealth';
import { useHealthStore } from '@/store/healthStore';
import HeaderDropdownPanel from '@/components/shared/HeaderDropdownPanel';
import HeaderOverlayPortal from '@/components/shared/HeaderOverlayPortal';
import SystemStatusPanel from '@/components/shared/SystemStatusPanel';
import { CheckCircle, ExclamationTriangle, Key, QuestionMarkCircle } from '@/components/icons';
import useHeaderDropdownDismiss from '@/hooks/useHeaderDropdownDismiss';
import useIsMobile from '@/hooks/useIsMobile';

export default function SystemStatusIndicator({ apiKey, className = '', label, variant = 'icon' }) {
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
  const performHealthCheck = useHealthStore((state) => state.performHealthCheck);
  const refreshOnOpenRef = useRef(false);

  const closePanel = useCallback(() => setIsOpen(false), []);
  useHeaderDropdownDismiss({ isOpen, onClose: closePanel, anchorRef: rootRef });

  const statusConfig = {
    healthy: {
      icon: CheckCircle,
      iconClass: 'text-emerald-500 dark:text-emerald-400',
      dotClass: 'bg-emerald-500',
      label: t('status.healthy'),
      description: t('status.healthyDescription'),
    },
    'invalid-key': {
      icon: Key,
      iconClass: 'text-red-500 dark:text-red-400',
      dotClass: 'bg-red-500',
      label: t('status.invalidKey'),
      description: t('status.invalidKeyDescription'),
    },
    'api-unhealthy': {
      icon: ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.apiUnhealthy'),
      description: t('status.apiUnhealthyDescription'),
    },
    'platform-unhealthy': {
      icon: ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.platformUnhealthy'),
      description: t('status.platformUnhealthyDescription'),
    },
    'backend-unhealthy': {
      icon: ExclamationTriangle,
      iconClass: 'text-amber-500 dark:text-amber-400',
      dotClass: 'bg-amber-500',
      label: t('status.backendUnhealthy'),
      description: t('status.backendUnhealthyDescription'),
    },
    'no-api-key': {
      icon: Key,
      iconClass: 'text-zinc-400',
      dotClass: 'bg-zinc-500',
      label: t('status.noApiKey'),
      description: t('status.noApiKeyDescription'),
    },
    unknown: {
      icon: QuestionMarkCircle,
      iconClass: 'text-zinc-400',
      dotClass: 'bg-zinc-500',
      label: t('status.unknown'),
      description: t('status.unknownDescription'),
    },
  };

  const config = statusConfig[overallStatus] || statusConfig.unknown;
  const IconComponent = config.icon;
  const sidebarTrigger = variant === 'sidebar';
  const sidebarStatus = {
    healthy: {
      label: t('rows.status.operational'),
      tone: 'ui-sidebar-status-pill--healthy',
    },
    'invalid-key': {
      label: t('rows.status.invalidKey'),
      tone: 'ui-sidebar-status-pill--error',
    },
    'api-unhealthy': {
      label: t('rows.status.issue'),
      tone: 'ui-sidebar-status-pill--warning',
    },
    'platform-unhealthy': {
      label: t('rows.status.issue'),
      tone: 'ui-sidebar-status-pill--warning',
    },
    'backend-unhealthy': {
      label: t('rows.status.issue'),
      tone: 'ui-sidebar-status-pill--warning',
    },
    'no-api-key': {
      label: t('rows.status.notConfigured'),
      tone: 'ui-sidebar-status-pill--neutral',
    },
    unknown: {
      label: t('rows.status.unavailable'),
      tone: 'ui-sidebar-status-pill--neutral',
    },
  }[overallStatus] || {
    label: t('rows.status.unavailable'),
    tone: 'ui-sidebar-status-pill--neutral',
  };

  const handleToggle = useCallback(() => {
    if (!isOpen) {
      refreshOnOpenRef.current = true;
    }
    setIsOpen((open) => !open);
  }, [isOpen]);

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
    <div
      ref={rootRef}
      className={`relative shrink-0 ${sidebarTrigger ? 'w-full' : ''} ${className}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className={`${sidebarTrigger ? 'ui-sidebar-action' : 'ui-dropdown-icon-btn'} ${
          isLoading && !sidebarTrigger ? 'animate-pulse' : ''
        }`}
        aria-label={t('refreshStatus')}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        {sidebarTrigger ? (
          <>
            <span className="ui-sidebar-action-icon">
              {isLoading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-amber-500/40 border-t-amber-500" />
              ) : (
                <IconComponent className={`h-[18px] w-[18px] ${config.iconClass}`} />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <span
              className={`ui-sidebar-status-pill ${
                isLoading ? 'ui-sidebar-status-pill--neutral' : sidebarStatus.tone
              }`}
              title={config.label}
            >
              {isLoading ? t('rows.status.checking') : sidebarStatus.label}
            </span>
          </>
        ) : isLoading ? (
          <span className="size-4 border-2 border-amber-500/40 border-t-amber-500 rounded-full animate-spin" />
        ) : (
          <IconComponent className={`size-5 ${config.iconClass}`} />
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
              <dialog
                aria-label={t('refreshStatus')}
                className="pointer-events-auto w-full max-w-sm max-h-[min(90vh,32rem)] flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl dark:border-border-dark dark:bg-surface-alt-dark"
                style={{ display: 'flex' }}
                open
              >
                <div onClick={(e) => e.stopPropagation()} className="flex flex-col h-full">
                  <div className="overflow-y-auto overflow-x-hidden min-h-0 flex-1">
                    <SystemStatusPanel {...panelProps} />
                  </div>
                </div>
              </dialog>
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
