'use client';

import { useState, useId } from 'react';
import { useTranslations } from 'next-intl';
import Spinner from '@/components/shared/Spinner';
import DesktopLaunchAtLoginPanel from '@/components/desktop/DesktopLaunchAtLoginPanel';
import DesktopTrayPanel from '@/components/desktop/DesktopTrayPanel';
import DesktopUpdaterPanel from '@/components/desktop/DesktopUpdaterPanel';
import DesktopSettingsSection from '@/components/desktop/DesktopSettingsSection';
import {
  desktopBtnDanger,
  desktopBtnPrimary,
  desktopBtnSecondary,
  DesktopInfoCallout,
  desktopInputClass,
  DesktopMetaRow,
  DesktopStatusBadge,
} from '@/components/desktop/DesktopUi';
import { Bolt, Cloud, CloudDownload, Key, Layers } from '@/components/icons';
import { formatDate } from '@/components/uploads/utils';
import type { CredentialStatus } from '@/desktop/capabilities';

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

type DesktopSettingsGeneralTabProps = {
  apiKey: string;
  credentialStatus: CredentialStatus | null;
  instanceUrl?: string | null;
  canCustomizeUrl: boolean;
  canStoreApiKey: boolean;
  canUseTray: boolean;
  setToast?: (toast: { message: string; type: string }) => void;
  setInstanceUrl: (url: string) => Promise<string | null>;
  syncApiKey: (apiKey: string) => Promise<boolean>;
  clearCredential: () => Promise<boolean>;
};

export default function DesktopSettingsGeneralTab({
  apiKey,
  credentialStatus,
  instanceUrl,
  canCustomizeUrl,
  canStoreApiKey,
  canUseTray,
  setToast,
  setInstanceUrl,
  syncApiKey,
  clearCredential,
}: DesktopSettingsGeneralTabProps) {
  const t = useTranslations('Desktop');
  const [customUrl, setCustomUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncingKey, setSyncingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const instanceUrlInputId = useId();

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
      setShowCustomUrl(false);
    } catch (error) {
      notify(resolveErrorMessage(error, t('instanceUrlSaveFailed')), 'error');
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

  const credentialBadge = credentialStatus?.hasApiKey ? (
    <DesktopStatusBadge status="success">{t('credentialStoredShort')}</DesktopStatusBadge>
  ) : (
    <DesktopStatusBadge status="neutral">{t('credentialNotStoredShort')}</DesktopStatusBadge>
  );

  return (
    <div className="space-y-4">
      <DesktopSettingsSection
        title={t('launchAtLogin.title')}
        description={t('launchAtLogin.description')}
        icon={Bolt}
        compact
      >
        <DesktopLaunchAtLoginPanel embedded setToast={setToast} />
      </DesktopSettingsSection>

      {canUseTray ? (
        <DesktopSettingsSection
          title={t('tray.title')}
          description={t('tray.description')}
          icon={Layers}
          compact
        >
          <DesktopTrayPanel embedded setToast={setToast} />
        </DesktopSettingsSection>
      ) : null}

      <DesktopSettingsSection
        title={t('updater.title')}
        description={t('updater.description')}
        icon={CloudDownload}
        compact
      >
        <DesktopUpdaterPanel embedded setToast={setToast} />
      </DesktopSettingsSection>

      {canStoreApiKey ? (
        <DesktopSettingsSection
          title={t('credentialSyncTitle')}
          icon={Key}
          action={credentialBadge}
          compact
        >
          {credentialStatus?.hasApiKey ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted dark:text-muted-dark">
                {t('credentialStoredDetail')}
              </p>
              {credentialStatus.lastUpdatedAt ? (
                <p className="text-xs text-muted dark:text-muted-dark">
                  {t('credentialLastUpdated', {
                    date: formatDate(credentialStatus.lastUpdatedAt),
                  })}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {apiKey ? (
                  <button
                    type="button"
                    onClick={handleSyncApiKey}
                    disabled={syncingKey}
                    className={desktopBtnSecondary}
                  >
                    {syncingKey ? <Spinner className="size-4" /> : null}
                    {t('credentialSyncUpdateAction')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleClearCredential}
                  disabled={clearingKey}
                  className={desktopBtnDanger}
                >
                  {clearingKey ? <Spinner className="size-4" /> : null}
                  {t('clearCredentials')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-muted dark:text-muted-dark">
                {t('credentialSyncHelp')}
              </p>
              {!apiKey ? (
                <DesktopInfoCallout variant="warning">
                  {t('credentialSyncNoKey')}
                </DesktopInfoCallout>
              ) : null}
              <button
                type="button"
                onClick={handleSyncApiKey}
                disabled={syncingKey || !apiKey}
                className={desktopBtnPrimary}
              >
                {syncingKey ? <Spinner className="size-4" /> : null}
                {t('credentialSyncAction')}
              </button>
            </div>
          )}
        </DesktopSettingsSection>
      ) : null}

      {(canCustomizeUrl || instanceUrl) && (
        <DesktopSettingsSection
          title={t('advancedTitle')}
          description={t('advancedDescription')}
          icon={Cloud}
          compact
        >
          <div className="space-y-4">
            <DesktopMetaRow label={t('instanceUrlCurrent')} value={instanceUrl} mono />

            {canCustomizeUrl ? (
              <div className="border-t border-border/50 pt-4 dark:border-border-dark/50">
                {!showCustomUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomUrl(true)}
                    className={desktopBtnSecondary}
                  >
                    {t('instanceUrlChangeAction')}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-text dark:text-text-dark">
                        {t('instanceUrlTitle')}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark">
                        {t('instanceUrlHelp')}
                      </p>
                    </div>
                    <label htmlFor={instanceUrlInputId} className="sr-only">
                      {t('instanceUrlTitle')}
                    </label>
                    <input
                      id={instanceUrlInputId}
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://your-instance.example"
                      className={desktopInputClass}
                    />
                    <DesktopInfoCallout variant="warning">
                      {t('restartRequired')}
                    </DesktopInfoCallout>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveUrl}
                        disabled={savingUrl || !customUrl.trim()}
                        className={desktopBtnPrimary}
                      >
                        {savingUrl ? <Spinner className="size-4" /> : null}
                        {t('instanceUrlSave')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomUrl(false);
                          setCustomUrl('');
                        }}
                        className={desktopBtnSecondary}
                      >
                        {t('instanceUrlCancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </DesktopSettingsSection>
      )}
    </div>
  );
}
