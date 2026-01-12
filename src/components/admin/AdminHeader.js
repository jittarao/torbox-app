'use client';

import { useRouter, useParams } from 'next/navigation';
import useAdminStore from '@/store/adminStore';

export default function AdminHeader() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || 'en';
  const { logout } = useAdminStore();

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/admin`);
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Panel
        </h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
