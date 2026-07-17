'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import { DesktopInfoCallout, DesktopToggle } from '@/components/desktop/DesktopUi';

type DesktopLaunchAtLoginPanelProps = {
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

export default function DesktopLaunchAtLoginPanel({
  setToast,
  embedded = false,
}: DesktopLaunchAtLoginPanelProps) {
  const t = useTranslations('Desktop.launchAtLogin');
  const { capabilities } = useDesktopCapabilities();
  const launchAtLogin = useDesktopStore((state) => state.launchAtLogin);
  const setLaunchAtLoginEnabled = useDesktopStore((state) => state.setLaunchAtLoginEnabled);
  const [saving, setSaving] = useState(false);

  const canUseLaunchAtLogin = hasFeature(capabilities, 'launchAtLogin');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseLaunchAtLogin) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const handleToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setSaving(true);
    try {
      const status = await setLaunchAtLoginEnabled(next);
      if (!status) {
        notify(t('saveFailed'), 'error');
        return;
      }
      notify(next ? t('enabledSuccess') : t('disabledSuccess'), 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const osMismatch = launchAtLogin != null && launchAtLogin.enabled !== launchAtLogin.osEnabled;

  return (
    <div className="space-y-3">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/50 bg-surface-alt/40 px-4 py-4 dark:border-border-dark/50 dark:bg-surface-dark/40">
        <DesktopToggle
          id="desktop-launch-at-login"
          checked={launchAtLogin?.enabled ?? false}
          disabled={saving}
          busy={saving}
          onChange={handleToggle}
          label={t('label')}
          description={t('help')}
        />
      </div>

      {osMismatch ? (
        <DesktopInfoCallout variant="warning">{t('osMismatch')}</DesktopInfoCallout>
      ) : null}
    </div>
  );
}
