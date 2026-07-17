'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import DesktopFolderWatcherPanel from '@/components/desktop/DesktopFolderWatcherPanel';
import DesktopLaunchAtLoginPanel from '@/components/desktop/DesktopLaunchAtLoginPanel';
import DesktopNotificationsPanel from '@/components/desktop/DesktopNotificationsPanel';
import DesktopTrayPanel from '@/components/desktop/DesktopTrayPanel';
import DesktopUpdaterPanel from '@/components/desktop/DesktopUpdaterPanel';
import DesktopSettingsSection from '@/components/desktop/DesktopSettingsSection';
import {
  desktopBtnDanger,
  desktopBtnPrimary,
  desktopBtnSecondary,
  DesktopInfoCallout,
  desktopInputClass,
  DesktopStatusBadge,
  desktopTabDefault,
  desktopTabSelected,
} from '@/components/desktop/DesktopUi';
import { Bolt, Cloud, HardDrive, Key, Settings, Torrent } from '@/components/icons';
import { formatDate } from '@/components/uploads/utils';

type SettingsTab = 'general' | 'background' | 'watcher';

type DesktopSettingsPanelProps = {
  apiKey: string;
  setToast?: (toast: { message: string; type: string }) => void;
};

export default function DesktopSettingsPanel({ apiKey, setToast }: DesktopSettingsPanelProps) {
  const t = useTranslations('Desktop');
  const { available, initialized, capabilities, instanceUrl, credentialStatus } =
    useDesktopCapabilities();
  const setInstanceUrl = useDesktopStore((state) => state.setInstanceUrl);
  const syncApiKey = useDesktopStore((state) => state.syncApiKey);
  const clearCredential = useDesktopStore((state) => state.clearCredential);
  const watcherStatus = useDesktopStore((state) => state.watcherStatus);

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [customUrl, setCustomUrl] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);
  const [syncingKey, setSyncingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);

  if (!initialized || !available) {
    return null;
  }

  const canCustomizeUrl = hasFeature(capabilities, 'instanceUrl');
  const canStoreApiKey = hasFeature(capabilities, 'secureCredentials');
  const canUseWatcher = hasFeature(capabilities, 'folderWatcher');
  const canUseTray = hasFeature(capabilities, 'tray');
  const canUseNotifications = hasFeature(capabilities, 'nativeNotifications');
  const canUseUpdater = hasFeature(capabilities, 'updater');

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

  const tabs: {
    id: SettingsTab;
    label: string;
    description: string;
    icon: typeof Settings;
    badge?: { label: string; status: 'success' | 'neutral' };
  }[] = [
    {
      id: 'general',
      label: t('tabs.general'),
      description: t('tabs.generalDescription'),
      icon: Settings,
    },
    {
      id: 'background',
      label: t('tabs.background'),
      description: t('tabs.backgroundDescription'),
      icon: HardDrive,
    },
    {
      id: 'watcher',
      label: t('tabs.watcher'),
      description: t('tabs.watcherDescription'),
      icon: Torrent,
      badge: watcherStatus?.running
        ? { label: t('tabs.watcherActive'), status: 'success' }
        : undefined,
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
      <nav aria-label={t('tabs.ariaLabel')} className="lg:sticky lg:top-6 lg:w-60 lg:shrink-0">
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <li key={tab.id} className="min-w-[10.5rem] shrink-0 lg:min-w-0">
                <button
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative w-full rounded-xl border px-4 py-3 text-left transition-all ${
                    selected ? desktopTabSelected : desktopTabDefault
                  }`}
                >
                  {selected ? (
                    <span
                      className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-accent dark:bg-accent-dark"
                      aria-hidden
                    />
                  ) : null}
                  <span className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        selected
                          ? 'border-accent/25 bg-accent/10 text-accent dark:border-accent-dark/25 dark:bg-accent-dark/10 dark:text-accent-dark'
                          : 'border-border/60 bg-surface-alt text-muted group-hover:text-text dark:border-border-dark/60 dark:bg-surface-dark dark:text-muted-dark dark:group-hover:text-text-dark'
                      }`}
                    >
                      <TabIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            selected
                              ? 'text-text dark:text-text-dark'
                              : 'text-text dark:text-text-dark'
                          }`}
                        >
                          {tab.label}
                        </span>
                        {tab.badge ? (
                          <DesktopStatusBadge
                            status={tab.badge.status}
                            pulse={tab.badge.status === 'success'}
                          >
                            {tab.badge.label}
                          </DesktopStatusBadge>
                        ) : null}
                      </span>
                      <span
                        className={`mt-1 block text-xs leading-relaxed ${
                          selected
                            ? 'text-muted dark:text-muted-dark'
                            : 'text-muted dark:text-muted-dark'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 flex-1 space-y-5">
        {activeTab === 'general' && (
          <div className="space-y-5">
            <DesktopSettingsSection
              title={t('launchAtLogin.title')}
              description={t('launchAtLogin.description')}
              icon={Bolt}
            >
              <DesktopLaunchAtLoginPanel embedded setToast={setToast} />
            </DesktopSettingsSection>

            {canUseUpdater ? (
              <DesktopSettingsSection
                title={t('updater.title')}
                description={t('updater.description')}
                icon={HardDrive}
              >
                <DesktopUpdaterPanel embedded setToast={setToast} />
              </DesktopSettingsSection>
            ) : null}

            {canStoreApiKey ? (
              <DesktopSettingsSection
                title={t('credentialSyncTitle')}
                description={credentialStatus?.hasApiKey ? undefined : t('credentialSyncHelp')}
                icon={Key}
              >
                {credentialStatus?.hasApiKey ? (
                  <div className="space-y-4">
                    <DesktopInfoCallout variant="success">
                      <div className="space-y-1">
                        <p className="font-medium">{t('credentialStored')}</p>
                        {credentialStatus.lastUpdatedAt ? (
                          <p className="text-xs opacity-90">
                            {t('credentialLastUpdated', {
                              date: formatDate(credentialStatus.lastUpdatedAt),
                            })}
                          </p>
                        ) : null}
                        <p className="text-xs opacity-90">{t('credentialStoredDetail')}</p>
                      </div>
                    </DesktopInfoCallout>
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
                    <DesktopStatusBadge status="neutral">
                      {t('credentialNotStored')}
                    </DesktopStatusBadge>
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
              >
                <div className="space-y-5">
                  <div className="rounded-lg border border-border/50 bg-surface-alt/40 px-4 py-3 dark:border-border-dark/50 dark:bg-surface-dark/40">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted dark:text-muted-dark">
                      {t('instanceUrlCurrent')}
                    </p>
                    <p className="mt-1 break-all font-mono text-sm text-text dark:text-text-dark">
                      {instanceUrl}
                    </p>
                  </div>

                  {canCustomizeUrl ? (
                    <div className="space-y-3 border-t border-border/50 pt-5 dark:border-border-dark/50">
                      <div>
                        <h3 className="text-sm font-medium text-text dark:text-text-dark">
                          {t('instanceUrlTitle')}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-muted dark:text-muted-dark">
                          {t('instanceUrlHelp')}
                        </p>
                      </div>
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://your-instance.example"
                        className={desktopInputClass}
                      />
                      <DesktopInfoCallout variant="warning">
                        {t('restartRequired')}
                      </DesktopInfoCallout>
                      <button
                        type="button"
                        onClick={handleSaveUrl}
                        disabled={savingUrl || !customUrl.trim()}
                        className={desktopBtnPrimary}
                      >
                        {savingUrl ? <Spinner className="size-4" /> : null}
                        {t('instanceUrlSave')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </DesktopSettingsSection>
            )}
          </div>
        )}

        {activeTab === 'background' && (
          <div className="space-y-5">
            {canUseTray ? (
              <DesktopSettingsSection
                title={t('tray.title')}
                description={t('tray.description')}
                icon={HardDrive}
              >
                <DesktopTrayPanel embedded setToast={setToast} />
              </DesktopSettingsSection>
            ) : null}

            {canUseNotifications ? (
              <DesktopSettingsSection
                title={t('nativeNotifications.title')}
                description={t('nativeNotifications.description')}
                icon={Bolt}
              >
                <DesktopNotificationsPanel embedded setToast={setToast} />
              </DesktopSettingsSection>
            ) : null}

            {!canUseTray && !canUseNotifications ? (
              <DesktopSettingsSection title={t('tabs.background')} icon={HardDrive}>
                <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>
              </DesktopSettingsSection>
            ) : null}
          </div>
        )}

        {activeTab === 'watcher' && canUseWatcher && (
          <DesktopFolderWatcherPanel
            embedded
            hasCredential={Boolean(credentialStatus?.hasApiKey)}
            instanceUrl={instanceUrl}
            setToast={setToast}
          />
        )}

        {activeTab === 'watcher' && !canUseWatcher && (
          <DesktopSettingsSection title={t('folderWatcher.title')} icon={Torrent}>
            <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>
          </DesktopSettingsSection>
        )}
      </div>
    </div>
  );
}
