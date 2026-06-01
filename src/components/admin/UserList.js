'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import adminApiClient from '@/utils/adminApiClient';
import ConfirmButton from '@/components/shared/ConfirmButton';
import {
  AdminBadge,
  AdminCard,
  AdminEmpty,
  AdminFilterChip,
  AdminLoading,
  adminCardClass,
  adminInputClass,
  adminRowHoverClass,
  adminTableClass,
  adminTdClass,
  adminThClass,
  adminTheadClass,
} from './AdminUi';

export default function UserList({
  users,
  loading,
  pagination,
  filters,
  onUserClick,
  onPageChange,
  onStatusFilter,
  onSearch,
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

  const handleDelete = async (authId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
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
      !confirm(
        'Reactivate all inactive API keys? This will set is_active = 1 and status = active for every user with an inactive key.'
      )
    ) {
      return;
    }
    setReactivating(true);
    try {
      const data = await adminApiClient.reactivateApiKeys();
      const count = data?.reactivated ?? data?.count ?? 0;
      if (count > 0) {
        alert(`Reactivated ${count} API key(s).`);
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
      <AdminCard bodyClassName="!py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <form onSubmit={handleSearchSubmit} className="min-w-0 flex-1">
            <input
              type="search"
              placeholder="Search by auth ID or key name…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={adminInputClass}
            />
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <AdminFilterChip active={!filters?.status} onClick={() => onStatusFilter('all')}>
              All
            </AdminFilterChip>
            <AdminFilterChip
              active={filters?.status === 'active'}
              onClick={() => onStatusFilter('active')}
            >
              Active
            </AdminFilterChip>
            <AdminFilterChip
              active={filters?.status === 'inactive'}
              onClick={() => onStatusFilter('inactive')}
            >
              Inactive
            </AdminFilterChip>
            <button
              type="button"
              onClick={handleReactivateAllInactive}
              disabled={reactivating}
              className="ui-btn-accent shrink-0 disabled:opacity-50"
              title="Set all inactive API keys to active"
            >
              {reactivating ? 'Reactivating…' : 'Reactivate inactive'}
            </button>
          </div>
        </div>
      </AdminCard>

      <div className={`${adminCardClass} overflow-hidden`}>
        {loading ? (
          <AdminLoading label="Loading users…" />
        ) : users.length === 0 ? (
          <AdminEmpty message="No users match your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={adminTableClass}>
                <thead className={adminTheadClass}>
                  <tr>
                    <th className={adminThClass}>Auth ID</th>
                    <th className={adminThClass}>Key name</th>
                    <th className={adminThClass}>Status</th>
                    <th className={adminThClass}>Rules</th>
                    <th className={adminThClass}>DB size</th>
                    <th className={adminThClass}>Created</th>
                    <th className={`${adminThClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-border-dark/60">
                  {users.map((user) => (
                    <tr
                      key={user.auth_id}
                      onClick={() => onUserClick(user.auth_id)}
                      className={`cursor-pointer bg-white dark:bg-surface-alt-dark ${adminRowHoverClass}`}
                    >
                      <td className={`${adminTdClass} font-mono text-xs sm:text-sm`}>
                        {user.auth_id}
                      </td>
                      <td className={adminTdClass}>{user.key_name || 'N/A'}</td>
                      <td className={adminTdClass}>
                        <AdminBadge status={user.status === 'active' ? 'active' : 'inactive'}>
                          {user.status}
                        </AdminBadge>
                      </td>
                      <td className={adminTdClass}>{user.has_active_rules ? 'Yes' : 'No'}</td>
                      <td className={adminTdClass}>{user.db_size_formatted || 'N/A'}</td>
                      <td className={`${adminTdClass} text-muted dark:text-muted-dark`}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td
                        className={`${adminTdClass} text-right`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleStatusChange(user.auth_id, user.status, e)}
                            className="text-sm font-medium text-accent hover:underline dark:text-accent-dark"
                          >
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <ConfirmButton
                            onConfirm={(e) => handleDelete(user.auth_id, e)}
                            confirmText="Delete"
                            className="text-sm font-medium text-label-danger-text hover:underline dark:text-label-danger-text-dark"
                            disabled={deleting === user.auth_id}
                          >
                            {deleting === user.auth_id ? 'Deleting…' : 'Delete'}
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 ? (
              <div className="flex flex-col gap-3 border-t border-border/60 bg-surface-alt px-4 py-3 dark:border-border-dark/60 dark:bg-surface-dark sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted dark:text-muted-dark">
                  Showing {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onPageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="ui-btn-ghost disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => onPageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="ui-btn-ghost disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
