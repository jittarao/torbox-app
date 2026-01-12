'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '@/components/admin/AdminLayout';
import UserList from '@/components/admin/UserList';
import useAdminStore from '@/store/adminStore';
import Toast from '@/components/shared/Toast';

export default function AdminUsersPage() {
  const router = useRouter();
  const { users, usersLoading, usersPagination, userFilters, fetchUsers, setUserFilter } = useAdminStore();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUserClick = (authId) => {
    const locale = window.location.pathname.split('/')[1] || 'en';
    router.push(`/${locale}/admin/users/${authId}`);
  };

  const handlePageChange = (page) => {
    setUserFilter('page', page);
    fetchUsers({ page });
  };

  const handleStatusFilter = (status) => {
    setUserFilter('status', status === 'all' ? null : status);
    fetchUsers({ status: status === 'all' ? null : status, page: 1 });
  };

  const handleSearch = (search) => {
    setUserFilter('search', search);
    fetchUsers({ search, page: 1 });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h2>
        </div>

        <UserList
          users={users}
          loading={usersLoading}
          pagination={usersPagination}
          filters={userFilters}
          onUserClick={handleUserClick}
          onPageChange={handlePageChange}
          onStatusFilter={handleStatusFilter}
          onSearch={handleSearch}
        />
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </AdminLayout>
  );
}
