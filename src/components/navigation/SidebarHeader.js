'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { getVersion } from '@/utils/version';
import { useSidebar } from './SidebarContext';

function SidebarBrand() {
  const t = useTranslations('Header');
  const { collapsed } = useSidebar();

  return (
    <Link
      href="/"
      title={collapsed ? t('title') : undefined}
      className={`flex min-w-0 items-center rounded-lg py-1 transition-colors duration-150 hover:bg-zinc-100/80 dark:hover:bg-white/[0.04] ${
        collapsed ? 'justify-center' : 'gap-2.5'
      }`}
    >
      <Image
        src="/images/TBM-logo.png"
        alt={t('logo')}
        width={28}
        height={28}
        className="shrink-0"
      />
      <div
        className={`flex min-w-0 flex-col overflow-hidden transition-[opacity,width,margin] duration-300 ease-out ${
          collapsed ? 'pointer-events-none m-0 w-0 opacity-0' : 'opacity-100'
        }`}
      >
        <span className="truncate text-sm font-semibold text-primary-text dark:text-primary-text-dark">
          {t('title')}
        </span>
        <span className="truncate text-[11px] font-normal text-zinc-500 dark:text-zinc-500">
          v{getVersion()}
        </span>
      </div>
    </Link>
  );
}

function SidebarCollapseToggle() {
  const t = useTranslations('Header');
  const { collapsed, toggleCollapsed } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? t('menu.expandSidebar') : t('menu.collapseSidebar')}
      className="ui-header-icon-btn shrink-0 transition-transform duration-300 ease-out hover:scale-105 active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className={`h-5 w-5 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          collapsed ? 'rotate-180' : ''
        }`}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
      </svg>
    </button>
  );
}

export default function SidebarHeader({ showCollapseToggle = true }) {
  const { collapsed } = useSidebar();

  return (
    <div className="shrink-0 border-b border-border/40 dark:border-border-dark/40">
      <div
        className={`px-2 py-3 ${
          collapsed ? 'flex flex-col items-center gap-2' : 'flex items-start gap-1'
        }`}
      >
        <div className={collapsed ? 'flex justify-center' : 'min-w-0 flex-1'}>
          <SidebarBrand />
        </div>
        {showCollapseToggle ? <SidebarCollapseToggle /> : null}
      </div>
    </div>
  );
}
