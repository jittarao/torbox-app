'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/admin/users', label: 'Users', icon: '👥' },
  { path: '/admin/system', label: 'System', icon: '⚙️' },
  { path: '/admin/databases', label: 'Databases', icon: '💾' },
  { path: '/admin/automation', label: 'Automation', icon: '🤖' },
  { path: '/admin/settings', label: 'Settings', icon: '🔧' },
];

export default function AdminSidebar({ locale = 'en' }) {
  const pathname = usePathname();

  const isActive = (path) => {
    const fullPath = `/${locale}${path}`;
    if (path === '/admin/dashboard') {
      return pathname === fullPath || pathname === `/${locale}/admin`;
    }
    return pathname?.startsWith(fullPath);
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                href={`/${locale}${item.path}`}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive(item.path)
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
