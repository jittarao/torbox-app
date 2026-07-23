'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import { Key } from '@/components/icons';
import { AdminAlert, adminInputClass } from '@/components/admin/AdminUi';

export default function AdminLoginPageClient() {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { push } = useRouter();
  const params = useParams();
  const { authenticate, isAuthenticated, verifyAuth } = useAdminStore(
    useShallow((s) => ({
      authenticate: s.authenticate,
      isAuthenticated: s.isAuthenticated,
      verifyAuth: s.verifyAuth,
    }))
  );

  useEffect(() => {
    const checkAuth = async () => {
      const authenticated = await verifyAuth();
      if (authenticated) {
        const locale = params?.locale || 'en';
        push(`/${locale}/admin/dashboard`);
      }
    };
    checkAuth();
  }, [push, verifyAuth, params?.locale]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authenticate(adminKey);
      if (result.success) {
        const locale = params?.locale || 'en';
        push(`/${locale}/admin/dashboard`);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4 dark:bg-surface-dark">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border/60 bg-white p-8 shadow-lg dark:border-border-dark/60 dark:bg-surface-alt-dark sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/images/TBM-logo.png"
              alt="TorBox Manager"
              width={48}
              height={48}
              className="mb-4"
            />
            <h1 className="text-2xl font-semibold tracking-tight text-primary-text dark:text-primary-text-dark">
              Admin sign in
            </h1>
            <p className="mt-2 text-sm text-muted dark:text-muted-dark">
              Enter your admin API key to manage users, automation, and system health.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="admin-key"
                className="mb-1.5 block text-sm font-medium text-text dark:text-text-dark"
              >
                Admin API key
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted dark:text-muted-dark">
                  <Key className="size-4" aria-hidden />
                </span>
                <input
                  id="admin-key"
                  name="adminKey"
                  type="password"
                  required
                  autoComplete="current-password"
                  className={`${adminInputClass} pl-9`}
                  placeholder="••••••••••••••••"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {error ? <AdminAlert variant="danger">{error}</AdminAlert> : null}

            <button
              type="submit"
              disabled={loading || !adminKey}
              className="ui-btn-accent w-full py-2.5"
            >
              {loading ? 'Authenticating…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted dark:text-muted-dark">
            <a
              href={`/${params?.locale || 'en'}/`}
              className="font-medium text-accent hover:underline dark:text-accent-dark"
            >
              ← Back to TorBox Manager
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
