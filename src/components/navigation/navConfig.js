import {
  Archive,
  Bolt,
  Download,
  History,
  MagnifyingGlass,
  Rss,
  Settings,
  Upload,
  User,
} from '@/components/icons';

const MAIN_NAV_ITEMS = [
  { href: '/', labelKey: 'downloads', Icon: Download },
  {
    href: '/search',
    labelKey: 'search',
    Icon: MagnifyingGlass,
    visible: ({ searchPageDisabled }) => !searchPageDisabled,
  },
  { href: '/rss', labelKey: 'rss', Icon: Rss },
  { href: '/automation', labelKey: 'automation', Icon: Bolt },
  { href: '/link-history', labelKey: 'linkHistory', Icon: History },
  { href: '/uploads', labelKey: 'uploads', Icon: Upload },
  { href: '/archived', labelKey: 'archived', Icon: Archive },
];

const ACCOUNT_NAV_ITEMS = [
  { href: '/user', labelKey: 'user', Icon: User },
  {
    href: '/desktop',
    labelKey: 'settings',
    Icon: Settings,
    visible: ({ desktopAvailable }) => desktopAvailable,
  },
];

/** Profile link — quick access from mobile header */
export const USER_NAV_ITEM = ACCOUNT_NAV_ITEMS[0];

function filterVisible(items, ctx) {
  return items.filter((item) => (item.visible ? item.visible(ctx) : true));
}

function flattenNavSections(sections) {
  return sections.flatMap((section) => section.items);
}

export function buildNavItems(ctx = {}) {
  return {
    sections: [
      { id: 'main', items: filterVisible(MAIN_NAV_ITEMS, ctx) },
      { id: 'account', items: filterVisible(ACCOUNT_NAV_ITEMS, ctx) },
    ],
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
  const items = flattenNavSections(buildNavItems(ctx).sections);
  const tabHrefs = new Set(getMobileTabHrefs(ctx));
  const tabs = getMobileTabHrefs(ctx).flatMap((href) => {
    const found = items.find((item) => item.href === href);
    return found ? [found] : [];
  });
  const moreItems = items.filter((item) => !tabHrefs.has(item.href));

  return { tabs, moreItems };
}
