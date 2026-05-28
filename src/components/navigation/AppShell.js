'use client';

import { useCallback, useMemo, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import ReferralHeaderBanner from '@/components/referral/ReferralHeaderBanner';
import { useTheme } from '@/contexts/ThemeContext';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { buildNavItems, buildMobileNav, USER_NAV_ITEM } from './navConfig';
import useNavActive from './useNavActive';
import SidebarHeader from './SidebarHeader';
import SidebarNav from './SidebarNav';
import SidebarUtilitiesFooter from './SidebarUtilitiesFooter';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import MobileMoreSheet from './MobileMoreSheet';
import { SidebarContext, useSidebar } from './SidebarContext';
import useSidebarCollapsed from './useSidebarCollapsed';
import { useNotificationsPolling } from '@/components/shared/hooks/useNotificationsPolling';
import { useSessionHydrate } from '@/components/shared/hooks/useSessionHydrate';

const SIDEBAR_EXPANDED = '16rem';
const SIDEBAR_COLLAPSED = '4.5rem';

function DesktopSidebar({ apiKey, nav, isActive, getLabel, t, toggleDarkMode }) {
  const { collapsed } = useSidebar();
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/60 bg-surface/85 backdrop-blur-xl transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] dark:border-border-dark/60 dark:bg-surface-dark/85 md:flex"
      style={{ width: sidebarWidth }}
      aria-label={t('title')}
    >
      <SidebarHeader />
      <SidebarNav nav={nav} isActive={isActive} getLabel={getLabel} />
      <SidebarUtilitiesFooter
        apiKey={apiKey}
        t={t}
        toggleDarkMode={toggleDarkMode}
        layout="desktop"
      />
    </aside>
  );
}

export default function AppShell({ apiKey, children, className = '' }) {
  const { searchPageDisabled } = useFeatureFlags();
  useNotificationsPolling(apiKey);
  useSessionHydrate(apiKey);
  const t = useTranslations('Header');
  const { isActive, pathname } = useNavActive();
  const { toggleDarkMode } = useTheme();
  const { collapsed, toggleCollapsed, hydrated } = useSidebarCollapsed();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const navCtx = useMemo(() => ({ searchPageDisabled }), [searchPageDisabled]);
  const nav = useMemo(() => buildNavItems(navCtx), [navCtx]);
  const mobileNav = useMemo(() => buildMobileNav(navCtx), [navCtx]);

  const getLabel = useCallback((labelKey) => t(`menu.${labelKey}`), [t]);

  const closeMore = useCallback(() => setIsMoreOpen(false), []);
  const toggleMore = useCallback(() => setIsMoreOpen((open) => !open), []);

  const prevPathnameRef = useRef(pathname);
  if (pathname !== prevPathnameRef.current) {
    prevPathnameRef.current = pathname;
    setIsMoreOpen(false);
  }

  const isMoreRouteActive = useMemo(() => {
    if (isActive(USER_NAV_ITEM.href)) return true;
    return mobileNav.moreItems.some((item) => isActive(item.href));
  }, [isActive, mobileNav.moreItems]);

  const mobileTitle = useMemo(() => {
    const allItems = [...nav.items, USER_NAV_ITEM];
    const match = allItems.find((item) => isActive(item.href));
    if (match) return getLabel(match.labelKey);
    return t('title');
  }, [nav.items, isActive, getLabel, t]);

  const userLabel = getLabel(USER_NAV_ITEM.labelKey);
  const shellClass = ['min-h-screen', className].filter(Boolean).join(' ');
  const sidebarWidth = hydrated && collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const sidebarContextValue = useMemo(
    () => ({ collapsed: hydrated && collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed, hydrated]
  );

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <div
        className={shellClass}
        style={{
          '--sidebar-width': sidebarWidth,
          '--sidebar-width-expanded': SIDEBAR_EXPANDED,
          '--sidebar-width-collapsed': SIDEBAR_COLLAPSED,
        }}
      >
        <DesktopSidebar
          apiKey={apiKey}
          nav={nav}
          isActive={isActive}
          getLabel={getLabel}
          t={t}
          toggleDarkMode={toggleDarkMode}
        />

        <MobileHeader
          title={mobileTitle}
          apiKey={apiKey}
          isUserActive={isActive(USER_NAV_ITEM.href)}
          userLabel={userLabel}
        />

        <MobileBottomNav
          tabs={mobileNav.tabs}
          isActive={isActive}
          getLabel={getLabel}
          isMoreActive={isMoreRouteActive}
          isMoreOpen={isMoreOpen}
          onMorePress={toggleMore}
        />

        <MobileMoreSheet
          open={isMoreOpen}
          onClose={closeMore}
          moreItems={mobileNav.moreItems}
          isActive={isActive}
          getLabel={getLabel}
          apiKey={apiKey}
          t={t}
          toggleDarkMode={toggleDarkMode}
        />

        <div className="flex min-h-screen min-w-0 flex-col transition-[padding-left] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] md:pl-[var(--sidebar-width)]">
          <ReferralHeaderBanner apiKey={apiKey} />
          <main className="min-w-0 flex-1 pb-mobile-nav md:pb-0">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
