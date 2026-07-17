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
  DesktopMetaRow,
  DesktopStatusBadge,
  DesktopTabContentHeader,
  desktopTabDefault,
  desktopTabSelected,
} from '@/components/desktop/DesktopUi';
import { Bell, Bolt, Cloud, Key, Layers, Refresh, Settings, Torrent } from '@/components/icons';
import { formatDate } from '@/components/uploads/utils';

type SettingsTab = 'general' | 'notifications' | 'watcher';

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
  const [showCustomUrl, setShowCustomUrl] = useState(false);

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
      setShowCustomUrl(false);
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
    dot?: boolean;
  }[] = [
    {
      id: 'general',
      label: t('tabs.general'),
      description: t('tabs.generalDescription'),
      icon: Settings,
    },
    {
      id: 'notifications',
      label: t('tabs.notifications'),
      description: t('tabs.notificationsDescription'),
      icon: Bell,
    },
    {
      id: 'watcher',
      label: t('tabs.watcher'),
      description: t('tabs.watcherDescription'),
      icon: Torrent,
      dot: Boolean(watcherStatus?.running),
    },
  ];

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const credentialBadge = credentialStatus?.hasApiKey ? (
    <DesktopStatusBadge status="success">{t('credentialStoredShort')}</DesktopStatusBadge>
  ) : (
    <DesktopStatusBadge status="neutral">{t('credentialNotStoredShort')}</DesktopStatusBadge>
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <nav aria-label={t('tabs.ariaLabel')} className="lg:sticky lg:top-6 lg:w-48 lg:shrink-0">
        <div className="flex gap-1 rounded-xl border border-border/60 bg-surface-alt/60 p-1 dark:border-border-dark/60 dark:bg-surface-dark/60 lg:flex-col lg:gap-2 lg:border-0 lg:bg-transparent lg:p-0">
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full lg:justify-start lg:gap-2.5 lg:px-3 lg:py-2.5 lg:text-left ${
                  selected ? desktopTabSelected : desktopTabDefault
                }`}
              >
                {selected ? (
                  <span
                    className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-accent dark:bg-accent-dark lg:block"
                    aria-hidden
                  />
                ) : null}
                <TabIcon
                  className={`size-4 shrink-0 ${selected ? 'text-accent dark:text-accent-dark' : ''}`}
                />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate">{tab.label}</span>
                  {tab.dot ? (
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-label-success-text dark:bg-label-success-text-dark"
                      title={t('tabs.watcherActive')}
                      aria-label={t('tabs.watcherActive')}
                    />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <DesktopTabContentHeader
          title={activeTabMeta.label}
          action={
            activeTab === 'watcher' && watcherStatus?.running ? (
              <DesktopStatusBadge status="success" pulse>
                {t('tabs.watcherActive')}
              </DesktopStatusBadge>
            ) : null
          }
        />

        {activeTab === 'general' && (
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

            {canUseUpdater ? (
              <DesktopSettingsSection title={t('updater.title')} icon={Refresh} compact>
                <DesktopUpdaterPanel embedded setToast={setToast} />
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
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-4">
            {canUseNotifications ? (
              <DesktopSettingsSection
                title={t('nativeNotifications.title')}
                description={t('nativeNotifications.description')}
                icon={Bell}
                compact
              >
                <DesktopNotificationsPanel embedded setToast={setToast} />
              </DesktopSettingsSection>
            ) : (
              <DesktopSettingsSection title={t('tabs.notifications')} icon={Bell} compact>
                <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>
              </DesktopSettingsSection>
            )}
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
          <DesktopSettingsSection title={t('folderWatcher.title')} icon={Torrent} compact>
            <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>
          </DesktopSettingsSection>
        )}
      </div>
    </div>
  );
}
