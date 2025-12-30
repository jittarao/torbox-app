'use client';

import { useTranslations } from 'next-intl';
import Icons from '@/components/icons';

export default function AssetTypeTabs({ activeType, onTypeChange }) {
  const t = useTranslations('Common');

  const tabs = [
    {
      id: 'all',
      label: t('itemTypes.All'),
      icon: <Icons.All className="w-4 h-4" />,
    },
    {
      id: 'torrents',
      label: t('itemTypes.Torrents'),
      icon: <Icons.Torrent className="w-4 h-4 rotate-[135deg]" />,
    },
    {
      id: 'usenet',
      label: t('itemTypes.Usenet'),
      icon: <Icons.Usenet className="w-4 h-4" />,
    },
    {
      id: 'webdl',
      label: t('itemTypes.Webdl'),
      icon: <Icons.Webdl className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex justify-center mb-8 px-4">
      <div className="flex p-1.5 glass rounded-2xl border border-border/50 dark:border-border-dark/50 gap-1 overflow-x-auto no-scrollbar max-w-full">
        {tabs.map((tab) => {
          const isActive = activeType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTypeChange(tab.id)}
              className={`
                relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap
                ${isActive
                  ? 'bg-primary text-white shadow-premium dark:shadow-premium-dark scale-100'
                  : 'text-primary-text/60 dark:text-primary-text-dark/60 hover:text-primary hover:bg-primary/5 active:scale-95'
                }
              `}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute -bottom-px left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white/40"></span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

