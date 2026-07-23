'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import adminApiClient from '@/utils/adminApiClient';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';
import UserListToolbar from './UserListToolbar';
import UserListTable from './UserListTable';

export default function UserList({
  users,
  loading,
  pagination,
  filters,
  onUserClick,
  onPageChange,
  onStatusFilter,
  onActivityFilter,
  onSearch,
  onSort,
  sort = 'created_at',
  sortDirection = 'desc',
  onUsersUpdated,
}) {
  const { deleteUser, updateUserStatus, fetchUsers } = useAdminStore(
    useShallow((s) => ({
      deleteUser: s.deleteUser,
      updateUserStatus: s.updateUserStatus,
      fetchUsers: s.fetchUsers,
    }))
  );
  const [deleting, setDeleting] = useState(null);
  const [reactivating, setReactivating] = useState(false);
  const [searchValue, setSearchValue] = useState(filters?.search || '');
  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });
  const { alert, AppAlert } = useAppAlert();

  const handleDelete = async (authId, e) => {
    e.stopPropagation();
    if (
      !(await confirm('Are you sure you want to delete this user? This action cannot be undone.', {
        confirmLabel: 'Delete',
      }))
    ) {
      return;
    }

    setDeleting(authId);
    try {
      const result = await deleteUser(authId);
      if (!result.success) {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const handleStatusChange = async (authId, currentStatus, e) => {
    e.stopPropagation();
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const result = await updateUserStatus(authId, newStatus);
      if (!result.success) {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearch(searchValue);
  };

  const handleReactivateAllInactive = async () => {
    if (
      !(await confirm(
        'Reactivate all inactive API keys? This will set is_active = 1 and status = active for every user with an inactive key.',
        { confirmLabel: 'Reactivate', confirmVariant: 'primary' }
      ))
    ) {
      return;
    }
    setReactivating(true);
    try {
      const data = await adminApiClient.reactivateApiKeys();
      const count = data?.reactivated ?? data?.count ?? 0;
      if (count > 0) {
        alert(`Reactivated ${count} API key(s).`, 'success');
        fetchUsers(filters);
        onUsersUpdated?.();
      } else {
        alert('No inactive API keys to reactivate.');
      }
    } catch (err) {
      alert(`Error: ${err.message || 'Failed to reactivate keys'}`);
    } finally {
      setReactivating(false);
    }
  };

  return (
    <div className="space-y-4">
      <UserListToolbar
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
        onSearchSubmit={handleSearchSubmit}
        filters={filters}
        onStatusFilter={onStatusFilter}
        onActivityFilter={onActivityFilter}
        reactivating={reactivating}
        onReactivateAllInactive={handleReactivateAllInactive}
      />

      <UserListTable
        users={users}
        loading={loading}
        pagination={pagination}
        sort={sort}
        sortDirection={sortDirection}
        deleting={deleting}
        onUserClick={onUserClick}
        onPageChange={onPageChange}
        onSort={onSort}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
      />

      <ConfirmDialog />
      <AppAlert />
    </div>
  );
}
