'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import {
  DesktopInfoCallout,
  DesktopToggle,
  desktopBtnSecondary,
} from '@/components/desktop/DesktopUi';

type DesktopNotificationsPanelProps = {
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

export default function DesktopNotificationsPanel({
  setToast,
  embedded = false,
}: DesktopNotificationsPanelProps) {
  const t = useTranslations('Desktop.nativeNotifications');
  const { capabilities } = useDesktopCapabilities();
  const notificationSettings = useDesktopStore((state) => state.notificationSettings);
  const saveNotificationSettings = useDesktopStore((state) => state.saveNotificationSettings);
  const sendTestNotification = useDesktopStore((state) => state.sendTestNotification);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const canUseNotifications = hasFeature(capabilities, 'nativeNotifications');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseNotifications) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const updateSetting = async (
    key: 'nativeNotifications' | 'notifyOnUploadSuccess' | 'notifyOnUploadFailure',
    checked: boolean
  ) => {
    if (!notificationSettings) {
      return;
    }

    setSaving(true);
    try {
      const saved = await saveNotificationSettings({
        ...notificationSettings,
        [key]: checked,
      });
      if (!saved) {
        notify(t('saveFailed'), 'error');
        return;
      }
      notify(t('saveSuccess'), 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const ok = await sendTestNotification();
      notify(ok ? t('testSuccess') : t('testFailed'), ok ? 'success' : 'error');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('testFailed'), 'error');
    } finally {
      setTesting(false);
    }
  };

  const masterEnabled = notificationSettings?.nativeNotifications ?? true;

  return (
    <div className="space-y-3">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-border/50 bg-surface-alt/40 px-4 py-4 dark:border-border-dark/50 dark:bg-surface-dark/40">
        <DesktopToggle
          id="desktop-native-notifications"
          checked={masterEnabled}
          disabled={saving || !notificationSettings}
          busy={saving}
          onChange={(event) => updateSetting('nativeNotifications', event.target.checked)}
          label={t('enabledLabel')}
          description={t('enabledHelp')}
        />
        <DesktopToggle
          id="desktop-notify-upload-success"
          checked={notificationSettings?.notifyOnUploadSuccess ?? true}
          disabled={saving || !notificationSettings || !masterEnabled}
          busy={saving}
          onChange={(event) => updateSetting('notifyOnUploadSuccess', event.target.checked)}
          label={t('uploadSuccessLabel')}
          description={t('uploadSuccessHelp')}
        />
        <DesktopToggle
          id="desktop-notify-upload-failure"
          checked={notificationSettings?.notifyOnUploadFailure ?? true}
          disabled={saving || !notificationSettings || !masterEnabled}
          busy={saving}
          onChange={(event) => updateSetting('notifyOnUploadFailure', event.target.checked)}
          label={t('uploadFailureLabel')}
          description={t('uploadFailureHelp')}
        />
      </div>

      <button
        type="button"
        onClick={handleTest}
        disabled={testing || !masterEnabled}
        className={desktopBtnSecondary}
      >
        {testing ? <Spinner className="size-4" /> : null}
        {t('testAction')}
      </button>
    </div>
  );
}
