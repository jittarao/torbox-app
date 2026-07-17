'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDesktopCapabilities } from '@/desktop/useDesktopCapabilities';
import { useDesktopStore } from '@/store/desktopStore';
import { hasFeature } from '@/desktop/capabilities';
import {
  DesktopInfoCallout,
  DesktopSettingGroup,
  DesktopSettingGroupItem,
  DesktopToggle,
} from '@/components/desktop/DesktopUi';

type DesktopTrayPanelProps = {
  setToast?: (toast: { message: string; type: string }) => void;
  embedded?: boolean;
};

export default function DesktopTrayPanel({ setToast, embedded = false }: DesktopTrayPanelProps) {
  const t = useTranslations('Desktop.tray');
  const { capabilities } = useDesktopCapabilities();
  const traySettings = useDesktopStore((state) => state.traySettings);
  const saveTraySettings = useDesktopStore((state) => state.saveTraySettings);
  const [savingKey, setSavingKey] = useState<'closeToTray' | 'minimizeToTray' | null>(null);

  const canUseTray = hasFeature(capabilities, 'tray');

  const notify = (message: string, type: 'success' | 'error') => {
    setToast?.({ message, type });
  };

  if (!canUseTray) {
    return <DesktopInfoCallout variant="warning">{t('updateDesktopApp')}</DesktopInfoCallout>;
  }

  const updateSetting = async (key: 'closeToTray' | 'minimizeToTray', checked: boolean) => {
    if (!traySettings) {
      return;
    }

    setSavingKey(key);
    try {
      const saved = await saveTraySettings({
        ...traySettings,
        [key]: checked,
      });
      if (!saved) {
        notify(t('saveFailed'), 'error');
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t('saveFailed'), 'error');
    } finally {
      setSavingKey(null);
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
          <DesktopToggle
            id="desktop-close-to-tray"
            checked={traySettings?.closeToTray ?? true}
            disabled={!traySettings || savingKey === 'closeToTray'}
            busy={savingKey === 'closeToTray'}
            onChange={(event) => updateSetting('closeToTray', event.target.checked)}
            label={t('closeToTrayLabel')}
            description={t('closeToTrayHelp')}
          />
        </DesktopSettingGroupItem>
        <DesktopSettingGroupItem>
          <DesktopToggle
            id="desktop-minimize-to-tray"
            checked={traySettings?.minimizeToTray ?? false}
            disabled={!traySettings || savingKey === 'minimizeToTray'}
            busy={savingKey === 'minimizeToTray'}
            onChange={(event) => updateSetting('minimizeToTray', event.target.checked)}
            label={t('minimizeToTrayLabel')}
            description={t('minimizeToTrayHelp')}
          />
        </DesktopSettingGroupItem>
      </DesktopSettingGroup>
    </div>
  );
}
