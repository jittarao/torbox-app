'use client';

import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import Icons from '@/components/icons';
import NotificationBell from '@/components/notifications/NotificationBell';
import SystemStatusIndicator from '@/components/shared/SystemStatusIndicator';
import ReferralDropdown from '@/components/ReferralDropdown';
import { GITHUB_REPO_URL } from '@/components/constants';
import { useSidebar } from './SidebarContext';

function UtilityFlyout({ children, className = '' }) {
  return (
    <div className={`ui-sidebar-flyout-anchor relative z-[260] shrink-0 ${className}`}>
      {children}
    </div>
  );
}

function SidebarUtilityRow({ icon: Icon, label, children }) {
  return (
    <li className="ui-sidebar-utility-row">
      <div className="ui-sidebar-utility-label">
        <Icon className="h-[18px] w-[18px] shrink-0 opacity-80" aria-hidden />
        <span className="truncate">{label}</span>
      </div>
      <UtilityFlyout>{children}</UtilityFlyout>
    </li>
  );
}

function CollapsedUtilities({ apiKey, t, toggleDarkMode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 border-t border-border/60 px-2 py-3 dark:border-border-dark/60">
      <UtilityFlyout>
        <ReferralDropdown apiKey={apiKey} iconOnly />
      </UtilityFlyout>
      {apiKey ? (
        <UtilityFlyout>
          <NotificationBell apiKey={apiKey} />
        </UtilityFlyout>
      ) : null}
      <UtilityFlyout>
        <SystemStatusIndicator apiKey={apiKey} />
      </UtilityFlyout>
      <div className="my-1 h-px w-8 bg-border/60 dark:bg-border-dark/60" />
      <button
        onClick={toggleDarkMode}
        aria-label={t('theme.toggle')}
        className="ui-header-icon-btn"
        type="button"
      >
        <Icons.Sun className="block h-5 w-5 dark:hidden" />
        <Icons.Moon className="hidden h-5 w-5 dark:block" />
      </button>
      <UtilityFlyout>
        <LanguageSwitcher compact />
      </UtilityFlyout>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub Repository"
        className="ui-header-icon-btn"
        title="GitHub"
      >
        <Icons.GitHub className="h-5 w-5" />
      </a>
    </div>
  );
}

export default function SidebarUtilitiesFooter({ apiKey, t, toggleDarkMode, layout = 'desktop' }) {
  const { collapsed } = useSidebar();

  if (layout === 'mobile') {
    return (
      <div className="space-y-1 border-t border-border/60 px-3 py-4 dark:border-border-dark/60">
        <p className="ui-sidebar-section-label !pt-0">{t('menu.tools')}</p>
        <ul className="space-y-0.5">
          <SidebarUtilityRow icon={Icons.Gift} label={t('menu.referrals')}>
            <ReferralDropdown apiKey={apiKey} />
          </SidebarUtilityRow>
          {apiKey ? (
            <SidebarUtilityRow icon={Icons.Bell} label={t('menu.notifications')}>
              <NotificationBell apiKey={apiKey} />
            </SidebarUtilityRow>
          ) : null}
          <SidebarUtilityRow icon={Icons.CheckCircle} label={t('menu.systemStatus')}>
            <SystemStatusIndicator apiKey={apiKey} />
          </SidebarUtilityRow>
        </ul>
        <p className="ui-sidebar-section-label">{t('menu.preferences')}</p>
        <div className="ui-sidebar-pref-panel space-y-2 !mx-0">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{t('theme.toggle')}</span>
            <button
              onClick={toggleDarkMode}
              aria-label={t('theme.toggle')}
              className="ui-theme-toggle"
              type="button"
            >
              <span className="ui-theme-toggle-knob">
                <Icons.Sun className="block h-4 w-4 dark:hidden" />
                <Icons.Moon className="hidden h-4 w-4 dark:block" />
              </span>
            </button>
          </div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('menu.language') || 'Language'}
            </span>
            <LanguageSwitcher />
          </div>
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="ui-sidebar-footer-link !mx-0"
        >
          <Icons.GitHub className="h-4 w-4" />
          GitHub
        </a>
      </div>
    );
  }

  if (collapsed) {
    return <CollapsedUtilities apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className="shrink-0 border-t border-border/60 pb-3 dark:border-border-dark/60">
      <p className="ui-sidebar-section-label">{t('menu.tools')}</p>
      <ul className="space-y-0.5 px-1">
        <li>
          <UtilityFlyout className="block w-full">
            <ReferralDropdown apiKey={apiKey} variant="sidebar" />
          </UtilityFlyout>
        </li>
        {apiKey ? (
          <SidebarUtilityRow icon={Icons.Bell} label={t('menu.notifications')}>
            <NotificationBell apiKey={apiKey} />
          </SidebarUtilityRow>
        ) : null}
        <SidebarUtilityRow icon={Icons.Activity} label={t('menu.systemStatus')}>
          <SystemStatusIndicator apiKey={apiKey} />
        </SidebarUtilityRow>
      </ul>

      <p className="ui-sidebar-section-label">{t('menu.preferences')}</p>
      <div className="ui-sidebar-pref-panel">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center gap-1 rounded-md py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {t('theme.toggle')}
            </span>
            <button
              onClick={toggleDarkMode}
              aria-label={t('theme.toggle')}
              className="ui-theme-toggle shrink-0"
              type="button"
            >
              <span className="ui-theme-toggle-knob">
                <Icons.Sun className="block h-4 w-4 dark:hidden" />
                <Icons.Moon className="hidden h-4 w-4 dark:block" />
              </span>
            </button>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md py-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              {t('menu.language')}
            </span>
            <UtilityFlyout className="w-full">
              <LanguageSwitcher variant="sidebar-cell" />
            </UtilityFlyout>
          </div>
        </div>
      </div>

      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="ui-sidebar-footer-link"
      >
        <Icons.GitHub className="h-4 w-4" />
        GitHub
      </a>
    </div>
  );
}
