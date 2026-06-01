'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import UserDetail from '@/components/admin/UserDetail';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import Toast from '@/components/shared/Toast';
import { AdminEmpty, AdminLoading, AdminPageHeader } from '@/components/admin/AdminUi';

export default function UserDetailPageClient() {
  const params = useParams();
  const { push } = useRouter();
  const authId = params.authId;
  const locale = params?.locale || 'en';
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
        <AdminLoading label="Loading user details…" />
      </AdminLayout>
    );
  }

  if (!selectedUserData) {
    return (
      <AdminLayout>
        <AdminEmpty message="User not found." />
        <div className="mt-4 text-center">
          <button type="button" onClick={() => push(`/${locale}/admin/users`)} className="ui-btn-accent">
            Back to users
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="User details"
          description={selectedUserData.key_name || selectedUserData.auth_id}
          actions={
            <button type="button" onClick={() => push(`/${locale}/admin/users`)} className="ui-btn-ghost">
              ← Users
            </button>
          }
        />

        <UserDetail user={selectedUserData} />
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </AdminLayout>
  );
}
