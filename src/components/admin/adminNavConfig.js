import {
  Activity,
  BarChart3,
  Bolt,
  Cog,
  HardDrive,
  MagnifyingGlass,
  Preferences,
  User,
} from '@/components/icons';

export const ADMIN_NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard', Icon: BarChart3 },
  { path: '/admin/users', label: 'Users', Icon: User },
  { path: '/admin/system', label: 'System', Icon: Activity },
  { path: '/admin/databases', label: 'Databases', Icon: HardDrive },
  { path: '/admin/diagnostics', label: 'Diagnostics', Icon: MagnifyingGlass },
  { path: '/admin/automation', label: 'Automation', Icon: Bolt },
  { path: '/admin/settings', label: 'Settings', Icon: Preferences },
];

export const ADMIN_SIDEBAR_WIDTH = '15.5rem';
