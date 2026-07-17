'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';

type DesktopSettingsPanelProps = {
  apiKey: string;
  setToast?: (toast: { message: string; type: string }) => void;
};

export default function DesktopSettingsPanel({ apiKey, setToast }: DesktopSettingsPanelProps) {
  const t = useTranslations('Desktop');
  const {
    available,
    initialized,
    hello,
    capabilities,
    platform,
    appVersion,
    protocolVersion,
    instanceUrl,
    credentialStatus,
  } = useDesktopCapabilities();
  const setInstanceUrl = useDesktopStore((state) => state.setInstanceUrl);
  const syncApiKey = useDesktopStore((state) => state.syncApiKey);
  const clearCredential = useDesktopStore((state) => state.clearCredential);

  const [customUrl, setCustomUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncingKey, setSyncingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);

  if (!initialized) {
    return null;
  }

  if (!available) {
    return null;
  }

  const canCustomizeUrl = hasFeature(capabilities, 'instanceUrl');
  const canStoreApiKey = hasFeature(capabilities, 'secureCredentials');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  const handleSaveUrl = async () => {
    if (!customUrl.trim()) {
      return;
    }
    setSavingUrl(true);
    try {
      const normalized = await setInstanceUrl(customUrl.trim());
      if (!normalized) {
        notify(t('instanceUrlSaveFailed'), 'error');
        return;
      }
      notify(t('instanceUrlSaved'), 'success');
      setCustomUrl('');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('instanceUrlSaveFailed'), 'error');
    } finally {
      setSavingUrl(false);
    }
  };

  const handleSyncApiKey = async () => {
    if (!apiKey) {
      notify(t('credentialSyncNoKey'), 'error');
      return;
    }
    setSyncingKey(true);
    try {
      const ok = await syncApiKey(apiKey);
      notify(ok ? t('credentialSyncSuccess') : t('credentialSyncFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('credentialSyncFailed'), 'error');
    } finally {
      setSyncingKey(false);
    }
  };

  const handleClearCredential = async () => {
    setClearingKey(true);
    try {
      const ok = await clearCredential();
      notify(
        ok ? t('clearCredentialsSuccess') : t('clearCredentialsFailed'),
        ok ? 'success' : 'error'
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : t('clearCredentialsFailed'), 'error');
    } finally {
      setClearingKey(false);
    }
  };

  return (
    <section className="bg-surface-elevated dark:bg-surface-elevated-dark rounded-lg shadow-md p-6 mb-6 border border-border dark:border-border-dark">
      <h2 className="text-xl font-semibold text-text dark:text-text-dark mb-1">{t('title')}</h2>
      <p className="text-sm text-muted dark:text-muted-dark mb-6">{t('description')}</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('appInfoTitle')}</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-muted-dark">{t('appVersion')}</dt>
              <dd className="text-text dark:text-text-dark font-mono">
                {appVersion ?? hello?.appVersion}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-muted-dark">{t('platform')}</dt>
              <dd className="text-text dark:text-text-dark capitalize">{platform}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-muted-dark">{t('protocolVersion')}</dt>
              <dd className="text-text dark:text-text-dark font-mono">{protocolVersion}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted dark:text-muted-dark">{t('instanceUrlCurrent')}</dt>
              <dd className="text-text dark:text-text-dark font-mono text-right break-all">
                {instanceUrl}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          {canCustomizeUrl && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-text dark:text-text-dark">
                {t('instanceUrlTitle')}
              </h3>
              <p className="text-xs text-muted dark:text-muted-dark">{t('instanceUrlHelp')}</p>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://your-instance.example"
                className="w-full rounded-md border border-border dark:border-border-dark bg-surface dark:bg-surface-dark px-3 py-2 text-sm text-text dark:text-text-dark"
              />
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('restartRequired')}</p>
              <button
                type="button"
                onClick={handleSaveUrl}
                disabled={savingUrl || !customUrl.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingUrl ? <Spinner className="size-4" /> : null}
                {t('instanceUrlSave')}
              </button>
            </div>
          )}

          {canStoreApiKey && (
            <div className="space-y-2 border-t border-border dark:border-border-dark pt-4">
              <h3 className="text-sm font-medium text-text dark:text-text-dark">
                {t('credentialSyncTitle')}
              </h3>
              <p className="text-xs text-muted dark:text-muted-dark">{t('credentialSyncHelp')}</p>
              <p className="text-sm text-text dark:text-text-dark">
                {credentialStatus?.hasApiKey ? t('credentialStored') : t('credentialNotStored')}
              </p>
              {credentialStatus?.lastUpdatedAt && (
                <p className="text-xs text-muted dark:text-muted-dark">
                  {t('credentialLastUpdated', { date: credentialStatus.lastUpdatedAt })}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSyncApiKey}
                  disabled={syncingKey || !apiKey}
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {syncingKey ? <Spinner className="size-4" /> : null}
                  {t('credentialSyncAction')}
                </button>
                <button
                  type="button"
                  onClick={handleClearCredential}
                  disabled={clearingKey || !credentialStatus?.hasApiKey}
                  className="inline-flex items-center gap-2 rounded-md border border-border dark:border-border-dark px-4 py-2 text-sm text-text dark:text-text-dark disabled:opacity-50"
                >
                  {clearingKey ? <Spinner className="size-4" /> : null}
                  {t('clearCredentials')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
