'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useParams } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';

export default function AdminLayout({ children }) {
  const { push } = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const locale = params?.locale || 'en';
  const { isAuthenticated, verifyAuth } = useAdminStore(
    useShallow((s) => ({
      isAuthenticated: s.isAuthenticated,
      verifyAuth: s.verifyAuth,
    }))
  );

  useEffect(() => {
    // Verify authentication on mount and route changes
    const checkAuth = async () => {
      const isLoginPage = pathname === `/${locale}/admin` || pathname === '/admin';
      if (!isLoginPage) {
        const authenticated = await verifyAuth();
        if (!authenticated) {
          push(`/${locale}/admin`);
        }
      }
    };
    checkAuth();
  }, [pathname, push, verifyAuth, locale]);

  // Don't render layout on login page
  const isLoginPage = pathname === `/${locale}/admin` || pathname === '/admin';
  if (isLoginPage || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar locale={locale} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
