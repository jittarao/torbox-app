'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import AppShell from '@/components/navigation/AppShell';
import DesktopSettingsPanel from '@/components/desktop/DesktopSettingsPanel';
import Toast from '@/components/shared/Toast';
import Spinner from '@/components/shared/Spinner';
import { HardDrive, Settings } from '@/components/icons';
import { useSession } from '@/components/shared/hooks/useSession';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { WEB_BRIDGE_VERSION } from '@/desktop/capabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { DesktopInfoCallout } from '@/components/desktop/DesktopUi';

function formatPlatformLabel(platform: string | null | undefined): string | null {
  if (!platform) {
    return null;
  }
  const labels: Record<string, string> = {
    macos: 'macOS',
    windows: 'Windows',
    linux: 'Linux',
  };
  return labels[platform.toLowerCase()] ?? platform.charAt(0).toUpperCase() + platform.slice(1);
}

function MetaBadge({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-white px-3 py-2 text-xs shadow-sm dark:border-border-dark/60 dark:bg-surface-dark">
      <span className="font-medium text-muted dark:text-muted-dark">{label}</span>
      <span className="font-mono text-text dark:text-text-dark">{value}</span>
    </div>
  );
}

export default function DesktopPageClient() {
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);
  const { apiKey, hydrated } = useSession();
  const { available, initialized, initError, appVersion, platform, hello } =
    useDesktopCapabilities();
  const retryInitialize = useDesktopStore((state) => state.retryInitialize);
  const t = useTranslations('Desktop');
  const tCommon = useTranslations('Common');

  if (!hydrated) {
    return <div className="min-h-screen bg-surface dark:bg-surface-dark font-sans" />;
  }

  const version = appVersion ?? hello?.appVersion;
  const platformLabel = formatPlatformLabel(platform);
  const bridgeOutdated =
    hello?.minimumSupportedWebBridgeVersion != null &&
    hello.minimumSupportedWebBridgeVersion > WEB_BRIDGE_VERSION;

  return (
    <AppShell apiKey={apiKey} className="min-h-screen bg-surface dark:bg-surface-dark font-sans">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8">
          <div className="flex flex-col gap-5 border-b border-border/50 pb-6 dark:border-border-dark/50 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white text-accent shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark dark:text-accent-dark">
                  <Settings className="size-5" />
                </span>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-text dark:text-text-dark sm:text-3xl">
                    {t('title')}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted dark:text-muted-dark">
                    {t('description')}
                  </p>
                </div>
              </div>
            </div>

            {available && (version || platformLabel) ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {version ? <MetaBadge label={t('appVersion')} value={version} /> : null}
                {platformLabel ? <MetaBadge label={t('platform')} value={platformLabel} /> : null}
              </div>
            ) : null}
          </div>
        </header>

        {!initialized ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <Spinner className="size-8" />
            <p className="text-sm text-muted dark:text-muted-dark">{tCommon('loading')}</p>
          </div>
        ) : initError ? (
          <div className="mx-auto max-w-xl rounded-xl border border-border/60 bg-white p-8 text-center shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark">
            <p className="text-base font-semibold text-text dark:text-text-dark">
              {t('initFailedTitle')}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted dark:text-muted-dark">
              {initError}
            </p>
            <button
              type="button"
              onClick={() => retryInitialize()}
              className="mt-6 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-accent-dark"
            >
              {t('initRetry')}
            </button>
          </div>
        ) : !available ? (
          <div className="mx-auto max-w-xl rounded-xl border border-border/60 bg-white p-8 text-center shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark">
            <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl border border-border/60 bg-surface-alt text-muted dark:border-border-dark/60 dark:bg-surface-dark dark:text-muted-dark">
              <HardDrive className="size-6" />
            </span>
            <p className="text-base font-semibold text-text dark:text-text-dark">
              {t('browserUnavailableTitle')}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted dark:text-muted-dark">
              {t('browserUnavailable')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bridgeOutdated ? (
              <DesktopInfoCallout variant="warning">{t('bridgeOutdated')}</DesktopInfoCallout>
            ) : null}
            <DesktopSettingsPanel apiKey={apiKey} setToast={setToast} />
          </div>
        )}
      </div>

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </AppShell>
  );
}
