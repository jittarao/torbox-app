import Icons from '@/components/icons';

/** Profile link — rendered in the sidebar header, not the main nav list */
export const USER_NAV_ITEM = {
  href: '/user',
  labelKey: 'user',
  Icon: Icons.User,
};

/** Core TorBox: downloads & search */
const MAIN_NAV = [
  { href: '/', labelKey: 'downloads', Icon: Icons.Download },
  {
    href: '/search',
    labelKey: 'search',
    Icon: Icons.MagnifyingGlass,
    visible: ({ searchPageDisabled }) => !searchPageDisabled,
  },
];

/** TorBox platform features */
const TORBOX_NAV = [
  { href: '/rss', labelKey: 'rss', Icon: Icons.Rss },
  { href: '/automation', labelKey: 'automation', Icon: Icons.Bolt },
];

/** TorBox Manager–only features (not in stock TorBox UI) */
const MANAGER_NAV = [
  { href: '/link-history', labelKey: 'linkHistory', Icon: Icons.History },
  { href: '/uploads', labelKey: 'uploads', Icon: Icons.Upload },
  { href: '/archived', labelKey: 'archived', Icon: Icons.Archive },
];

function filterVisible(items, ctx) {
  return items.filter((item) => (item.visible ? item.visible(ctx) : true));
}

export function buildNavItems(ctx = {}) {
  return {
    main: filterVisible(MAIN_NAV, ctx),
    torbox: filterVisible(TORBOX_NAV, ctx),
    manager: filterVisible(MANAGER_NAV, ctx),
  };
}
