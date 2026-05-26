import Icons from '@/components/icons';

const PRIMARY_NAV = [
  { href: '/', labelKey: 'downloads', Icon: Icons.Download },
  {
    href: '/search',
    labelKey: 'search',
    Icon: Icons.MagnifyingGlass,
    visible: ({ searchPageDisabled }) => !searchPageDisabled,
  },
];

const SECONDARY_NAV = [
  { href: '/user', labelKey: 'user', Icon: Icons.User },
  { href: '/link-history', labelKey: 'linkHistory', Icon: Icons.History },
  { href: '/archived', labelKey: 'archived', Icon: Icons.Archive },
  { href: '/rss', labelKey: 'rss', Icon: Icons.Rss },
  { href: '/automation', labelKey: 'automation', Icon: Icons.Bolt },
  { href: '/uploads', labelKey: 'uploads', Icon: Icons.Upload },
];

function filterVisible(items, ctx) {
  return items.filter((item) => (item.visible ? item.visible(ctx) : true));
}

export function buildNavItems(ctx = {}) {
  return {
    primary: filterVisible(PRIMARY_NAV, ctx),
    secondary: filterVisible(SECONDARY_NAV, ctx),
  };
}
