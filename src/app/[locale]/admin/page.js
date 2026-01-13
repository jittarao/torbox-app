'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAdminStore from '@/store/adminStore';

export default function AdminLoginPage() {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { authenticate, isAuthenticated, verifyAuth } = useAdminStore();

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      const authenticated = await verifyAuth();
      if (authenticated) {
        const locale = window.location.pathname.split('/')[1] || 'en';
        router.push(`/${locale}/admin/dashboard`);
      }
    };
    checkAuth();
  }, [router, verifyAuth]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authenticate(adminKey);
      if (result.success) {
        const locale = window.location.pathname.split('/')[1] || 'en';
        router.push(`/${locale}/admin/dashboard`);
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
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Enter your admin API key to access the admin panel
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-key" className="sr-only">
              Admin API Key
            </label>
            <input
              id="admin-key"
              name="adminKey"
              type="password"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Admin API Key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !adminKey}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
