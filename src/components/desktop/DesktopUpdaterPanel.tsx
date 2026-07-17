'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import Spinner from '@/components/shared/Spinner';
import {
  DesktopInfoCallout,
  DesktopStatusBadge,
  desktopBtnPrimary,
  desktopBtnSecondary,
} from '@/components/desktop/DesktopUi';

type DesktopUpdaterPanelProps = {
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

export default function DesktopUpdaterPanel({
  setToast,
  embedded = false,
}: DesktopUpdaterPanelProps) {
  const t = useTranslations('Desktop.updater');
  const { capabilities, appVersion } = useDesktopCapabilities();
  const pendingUpdate = useDesktopStore((state) => state.pendingUpdate);
  const checkForUpdate = useDesktopStore((state) => state.checkForUpdate);
  const installUpdate = useDesktopStore((state) => state.installUpdate);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);

  const canUseUpdater = hasFeature(capabilities, 'updater');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseUpdater) {
    return <DesktopInfoCallout variant="warning">{t('unavailable')}</DesktopInfoCallout>;
  }

  const handleCheck = async () => {
    setChecking(true);
    try {
      const update = await checkForUpdate();
      if (update) {
        notify(t('updateAvailable', { version: update.version }), 'success');
      } else {
        notify(t('upToDate'), 'success');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('checkFailed'), 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const ok = await installUpdate();
      if (!ok) {
        notify(t('installFailed'), 'error');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('installFailed'), 'error');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="space-y-4">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <div className="rounded-lg border border-border/50 bg-surface-alt/40 px-4 py-4 dark:border-border-dark/50 dark:bg-surface-dark/40">
        <p className="text-xs font-medium uppercase tracking-wide text-muted dark:text-muted-dark">
          {t('currentVersion')}
        </p>
        <p className="mt-1 font-mono text-sm text-text dark:text-text-dark">{appVersion ?? '—'}</p>
      </div>

      {pendingUpdate ? (
        <DesktopInfoCallout variant="success">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <DesktopStatusBadge status="success">
                {t('updateReady', { version: pendingUpdate.version })}
              </DesktopStatusBadge>
            </div>
            {pendingUpdate.notes ? (
              <p className="text-xs leading-relaxed opacity-90">{pendingUpdate.notes}</p>
            ) : null}
            <button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              className={desktopBtnPrimary}
            >
              {installing ? <Spinner className="size-4" /> : null}
              {t('installAction')}
            </button>
          </div>
        </DesktopInfoCallout>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCheck}
          disabled={checking}
          className={desktopBtnSecondary}
        >
          {checking ? <Spinner className="size-4" /> : null}
          {t('checkAction')}
        </button>
      </div>
    </div>
  );
}
