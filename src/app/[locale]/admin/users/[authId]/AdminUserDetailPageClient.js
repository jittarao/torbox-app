'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import UserDetail from '@/components/admin/UserDetail';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import Toast from '@/components/shared/Toast';

export default function UserDetailPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const authId = params.authId;
  const { selectedUserData, fetchUser } = useAdminStore(
    useShallow((s) => ({
      selectedUserData: s.selectedUserData,
      fetchUser: s.fetchUser,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (authId) {
      fetchUser(authId).then((result) => {
        setLoading(false);
        if (!result.success) {
          setToast({ message: result.error || 'Failed to load user', type: 'error' });
        }
      });
    }
  }, [authId, fetchUser]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full size-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading user details…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!selectedUserData) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">User not found</p>
          <button
            type="button"
            onClick={() => {
              const locale = useParams()?.locale || 'en';
              push(`/${locale}/admin/users`);
            }}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Users
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              const locale = useParams()?.locale || 'en';
              push(`/${locale}/admin/users`);
            }}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← Back
          </button>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">User Details</h2>
        </div>

        <UserDetail user={selectedUserData} />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
