'use client';

import { useTranslations } from 'next-intl';
import { Icons } from '@/components/icons';

export default function AssetTypeTabs({ activeType, onTypeChange }) {
  const t = useTranslations('Common');

  const tabs = [
    {
      id: 'torrents',
      label: t('itemTypes.Torrents'),
      icon: Icons.torrent,
    },
    {
      id: 'usenet',
      label: t('itemTypes.Usenet'),
      icon: Icons.usenet,
    },
    {
      id: 'webdl',
      label: t('itemTypes.Web'),
      icon: Icons.web,
    },
  ];

  return (
    <div className="border-b border-border dark:border-border-dark overflow-x-auto overflow-y-hidden">
      <nav className="-mb-px flex justify-start md:justify-center space-x-2 md:space-x-8 px-4 md:px-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTypeChange(tab.id)}
            className={`
              whitespace-nowrap py-3 md:py-4 px-3 md:px-1 border-b-2 font-medium text-sm flex items-center gap-2 md:gap-1 flex-1 md:flex-initial justify-center
              ${
                activeType === tab.id
                  ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                  : 'border-transparent text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:border-border dark:hover:border-border-dark'
              }
            `}
          >
            {tab.icon}
            <span className="min-w-[60px] md:min-w-0">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
