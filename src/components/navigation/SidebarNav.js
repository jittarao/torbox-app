'use client';

import { useTranslations } from 'next-intl';
import SidebarNavSection from './SidebarNavSection';

export default function SidebarNav({ nav, isActive, getLabel, onNavigate }) {
  const t = useTranslations('Header');

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-2">
      <SidebarNavSection items={nav.main} isActive={isActive} getLabel={getLabel} onNavigate={onNavigate} />
      <SidebarNavSection
        items={nav.torbox}
        isActive={isActive}
        getLabel={getLabel}
        onNavigate={onNavigate}
        className={nav.main.length ? 'mt-0.5' : ''}
      />
      <SidebarNavSection
        label={t('menu.sectionManager')}
        items={nav.manager}
        isActive={isActive}
        getLabel={getLabel}
        onNavigate={onNavigate}
        className="mt-1"
      />
    </nav>
  );
}
