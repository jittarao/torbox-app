import Icons from '@/components/icons';

/** Profile link — rendered after main nav items with a separator */
export const USER_NAV_ITEM = {
  href: '/user',
  labelKey: 'user',
  Icon: Icons.User,
};

const NAV_ITEMS = [
  { href: '/', labelKey: 'downloads', Icon: Icons.Download },
  {
    href: '/search',
    labelKey: 'search',
    Icon: Icons.MagnifyingGlass,
    visible: ({ searchPageDisabled }) => !searchPageDisabled,
  },
  { href: '/rss', labelKey: 'rss', Icon: Icons.Rss },
  { href: '/automation', labelKey: 'automation', Icon: Icons.Bolt },
  { href: '/link-history', labelKey: 'linkHistory', Icon: Icons.History },
  { href: '/uploads', labelKey: 'uploads', Icon: Icons.Upload },
  { href: '/archived', labelKey: 'archived', Icon: Icons.Archive },
];

function filterVisible(items, ctx) {
  return items.filter((item) => (item.visible ? item.visible(ctx) : true));
}

export function buildNavItems(ctx = {}) {
  return {
    items: filterVisible(NAV_ITEMS, ctx),
  };
}

/** Primary destinations for the mobile bottom tab bar (max 3 + More). */
function getMobileTabHrefs(ctx) {
  if (ctx.searchPageDisabled) {
    return ['/', '/rss', '/uploads'];
  }
  return ['/', '/search', '/uploads'];
}

export function buildMobileNav(ctx = {}) {
  const items = filterVisible(NAV_ITEMS, ctx);
  const tabHrefs = new Set(getMobileTabHrefs(ctx));
  const tabs = getMobileTabHrefs(ctx).flatMap((href) => {
    const found = items.find((item) => item.href === href);
    return found ? [found] : [];
  });
  const moreItems = items.filter((item) => !tabHrefs.has(item.href));

  return { tabs, moreItems };
}
