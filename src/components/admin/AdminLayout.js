'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useParams } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminMobileNav from './AdminMobileNav';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import { ADMIN_SIDEBAR_WIDTH } from './adminNavConfig';

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

  const isLoginPage = pathname === `/${locale}/admin` || pathname === '/admin';
  if (isLoginPage || !isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-screen bg-surface text-text dark:bg-surface-dark dark:text-text-dark"
      style={{ '--admin-sidebar-width': ADMIN_SIDEBAR_WIDTH }}
    >
      <AdminSidebar locale={locale} />
      <div className="flex min-h-screen min-w-0 flex-col pl-0 transition-[padding-left] duration-300 md:pl-[var(--admin-sidebar-width)]">
        <AdminMobileNav locale={locale} />
        <main className="min-w-0 flex-1">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
