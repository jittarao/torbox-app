'use client';

import { usePathname } from 'next/navigation';
import ApiKeyGate from '@/components/shared/ApiKeyGate';

function isAdminPath(pathname) {
  return pathname.includes('/admin');
}

export default function ApiKeyRouteGate({ children }) {
  const pathname = usePathname();

  if (isAdminPath(pathname)) {
    return children;
  }

  return <ApiKeyGate>{children}</ApiKeyGate>;
}
