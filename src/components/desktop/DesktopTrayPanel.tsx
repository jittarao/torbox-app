'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import type { BackgroundPresence } from '@/desktop/capabilities';
import { hasFeature } from '@/desktop/capabilities';
import {
  DesktopInfoCallout,
  DesktopSettingGroup,
  DesktopSettingGroupItem,
  desktopOptionBase,
  desktopOptionDefault,
  desktopOptionSelected,
} from '@/components/desktop/DesktopUi';

type DesktopTrayPanelProps = {
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

const BACKGROUND_PRESENCE_OPTIONS: BackgroundPresence[] = ['dock', 'tray'];

export default function DesktopTrayPanel({ setToast, embedded = false }: DesktopTrayPanelProps) {
  const t = useTranslations('Desktop.tray');
  const { capabilities } = useDesktopCapabilities();
  const traySettings = useDesktopStore((state) => state.traySettings);
  const saveTraySettings = useDesktopStore((state) => state.saveTraySettings);
  const [savingPresence, setSavingPresence] = useState(false);

  const canUseTray = hasFeature(capabilities, 'tray');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseTray) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const updateBackgroundPresence = async (presence: BackgroundPresence) => {
    if (!traySettings || traySettings.backgroundPresence === presence) {
      return;
    }

    setSavingPresence(true);
    try {
      const saved = await saveTraySettings({
        ...traySettings,
        backgroundPresence: presence,
      });
      if (!saved) {
        notify(t('saveFailed'), 'error');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSavingPresence(false);
    }
  };

  return (
    <div className="space-y-3">
      {!embedded ? (
        <div>
          <h3 className="text-sm font-medium text-text dark:text-text-dark">{t('title')}</h3>
          <p className="mt-1 text-xs text-muted dark:text-muted-dark">{t('description')}</p>
        </div>
      ) : null}

      <DesktopSettingGroup>
        <DesktopSettingGroupItem>
          <fieldset className="space-y-3" disabled={!traySettings || savingPresence}>
            <legend className="text-sm font-medium text-text dark:text-text-dark">
              {t('backgroundPresenceLegend')}
            </legend>
            {BACKGROUND_PRESENCE_OPTIONS.map((presence) => (
              <label
                key={presence}
                className={`${desktopOptionBase} ${
                  traySettings?.backgroundPresence === presence
                    ? desktopOptionSelected
                    : desktopOptionDefault
                }`}
              >
                <input
                  type="radio"
                  name="desktop-background-presence"
                  checked={traySettings?.backgroundPresence === presence}
                  onChange={() => updateBackgroundPresence(presence)}
                  className="mt-1 accent-accent dark:accent-accent-dark"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text dark:text-text-dark">
                    {presence === 'dock'
                      ? t('backgroundPresenceDockLabel')
                      : t('backgroundPresenceTrayLabel')}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted dark:text-muted-dark">
                    {presence === 'dock'
                      ? t('backgroundPresenceDockHelp')
                      : t('backgroundPresenceTrayHelp')}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </DesktopSettingGroupItem>
      </DesktopSettingGroup>

      <DesktopInfoCallout variant="neutral">{t('quitHint')}</DesktopInfoCallout>
    </div>
  );
}
