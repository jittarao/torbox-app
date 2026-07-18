'use client';

import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { GitHub, Moon, Sun } from '@/components/icons';
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

function CollapsedUtilities({ apiKey, t, toggleDarkMode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 border-t border-border/60 px-2 py-3 dark:border-border-dark/60">
      {apiKey ? (
        <UtilityFlyout>
          <NotificationBell apiKey={apiKey} />
        </UtilityFlyout>
      ) : null}
      <UtilityFlyout>
        <SystemStatusIndicator apiKey={apiKey} />
      </UtilityFlyout>
      <div className="my-1 h-px w-8 bg-zinc-200 dark:bg-zinc-700" />
      <UtilityFlyout>
        <ReferralDropdown apiKey={apiKey} iconOnly />
      </UtilityFlyout>
      <button
        onClick={toggleDarkMode}
        aria-label={t('theme.toggle')}
        className="ui-header-icon-btn"
        type="button"
      >
        <Sun className="block size-5 dark:hidden" />
        <Moon className="hidden size-5 dark:block" />
      </button>
      <UtilityFlyout>
        <LanguageSwitcher iconOnly />
      </UtilityFlyout>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHub Repository"
        className="ui-header-icon-btn"
        title="GitHub"
      >
        <GitHub className="size-5" />
      </a>
    </div>
  );
}

function SidebarDock({ apiKey, t, toggleDarkMode }) {
  return (
    <div className="ui-sidebar-dock">
      <div className="space-y-1">
        {apiKey ? (
          <UtilityFlyout className="block w-full">
            <NotificationBell apiKey={apiKey} variant="sidebar" />
          </UtilityFlyout>
        ) : null}
        <UtilityFlyout className="block w-full">
          <SystemStatusIndicator apiKey={apiKey} label={t('menu.systemStatus')} variant="sidebar" />
        </UtilityFlyout>
      </div>

      <div className="ui-sidebar-dock-secondary">
        <UtilityFlyout className="block w-full">
          <ReferralDropdown apiKey={apiKey} variant="sidebar-subtle" />
        </UtilityFlyout>
        <div className="ui-sidebar-controls">
          <button
            onClick={toggleDarkMode}
            aria-label={t('theme.toggle')}
            title={t('theme.toggle')}
            className="ui-sidebar-control-btn"
            type="button"
          >
            <Sun className="block size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </button>
          <UtilityFlyout className="flex min-w-0 flex-1">
            <LanguageSwitcher variant="sidebar-control" />
          </UtilityFlyout>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub Repository"
            title="GitHub"
            className="ui-sidebar-control-btn"
          >
            <GitHub className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SidebarUtilitiesFooter({ apiKey, t, toggleDarkMode, layout = 'desktop' }) {
  const { collapsed } = useSidebar();

  if (layout === 'mobile') {
    return (
      <div className="shrink-0 border-t border-border/60 dark:border-border-dark/60">
        <SidebarDock apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} />
      </div>
    );
  }

  if (collapsed) {
    return <CollapsedUtilities apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} />;
  }

  return (
    <div className="shrink-0 border-t border-border/60 dark:border-border-dark/60">
      <SidebarDock apiKey={apiKey} t={t} toggleDarkMode={toggleDarkMode} />
    </div>
  );
}
