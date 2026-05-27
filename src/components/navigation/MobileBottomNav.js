'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';

function MoreIcon({ className = 'size-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <circle cx="6" cy="6" r="1.75" />
      <circle cx="12" cy="6" r="1.75" />
      <circle cx="6" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
    </svg>
  );
}

function TabButton({ active, label, Icon, onClick, href, ariaCurrent }) {
  const className = active ? 'ui-mobile-tab-active' : 'ui-mobile-tab';

  if (href) {
    return (
      <Link href={href} className={className} aria-current={ariaCurrent}>
        <Icon className="size-5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} aria-current={ariaCurrent}>
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function MobileBottomNav({
  tabs,
  isActive,
  getLabel,
  isMoreActive,
  isMoreOpen,
  onMorePress,
}) {
  const t = useTranslations('Header');

  return (
    <nav
      className="z-mobile-bottom-nav fixed inset-x-0 bottom-0 border-t border-border/60 bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl dark:border-border-dark/60 dark:bg-surface-dark/95 md:hidden"
      aria-label={t('title')}
    >
      <div className="mx-auto flex h-[var(--mobile-bottom-nav-height)] max-w-lg items-stretch justify-around px-1">
        {tabs.map((item) => {
          const active = isActive(item.href);
          return (
            <TabButton
              key={item.href}
              href={item.href}
              label={getLabel(item.labelKey)}
              Icon={item.Icon}
              active={active}
              ariaCurrent={active ? 'page' : undefined}
            />
          );
        })}
        <TabButton
          label={t('menu.more')}
          Icon={isMoreOpen ? Icons.X : MoreIcon}
          active={isMoreActive || isMoreOpen}
          onClick={onMorePress}
          ariaCurrent={isMoreActive ? 'page' : undefined}
        />
      </div>
    </nav>
  );
}
