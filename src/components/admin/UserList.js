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
  adminTheadClass,
} from './AdminUi';

const userThClass =
  'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-muted-dark lg:px-4';

const userTdClass =
  'whitespace-nowrap px-3 py-2.5 text-sm text-text dark:text-text-dark lg:px-4';

function truncateAuthId(authId) {
  if (!authId) return '—';
  if (authId.length <= 18) return authId;
  return `${authId.slice(0, 10)}…${authId.slice(-6)}`;
}

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
              <table className={`${adminTableClass} w-full table-fixed`}>
                <colgroup>
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[7%]" />
                  <col className="w-[5%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className={adminTheadClass}>
                  <tr>
                    <th className={userThClass} title="SHA-256 auth ID">
                      Auth ID
                    </th>
                    <th className={userThClass}>Key</th>
                    <th className={userThClass}>Status</th>
                    <th className={userThClass} title="Active automation rules">
                      Rules
                    </th>
                    <th className={userThClass} title="Upload retention tier">
                      Tier
                    </th>
                    <th className={userThClass} title="Retained upload files">
                      Files
                    </th>
                    <th className={userThClass} title="Retained upload storage">
                      Storage
                    </th>
                    <th className={userThClass} title="Upload quota status">
                      Quota
                    </th>
                    <th className={userThClass} title="Per-user database size">
                      DB
                    </th>
                    <th className={userThClass}>Created</th>
                    <th className={`${userThClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 dark:divide-border-dark/60">
                  {users.map((user) => (
                    <tr
                      key={user.auth_id}
                      onClick={() => onUserClick(user.auth_id)}
                      className={`cursor-pointer bg-white dark:bg-surface-alt-dark ${adminRowHoverClass}`}
                    >
                      <td
                        className={`${userTdClass} max-w-0 font-mono text-xs`}
                        title={user.auth_id}
                      >
                        <span className="block truncate">{truncateAuthId(user.auth_id)}</span>
                      </td>
                      <td className={`${userTdClass} max-w-0`} title={user.key_name || undefined}>
                        <span className="block truncate">{user.key_name || '—'}</span>
                      </td>
                      <td className={userTdClass}>
                        <AdminBadge status={user.status === 'active' ? 'active' : 'inactive'}>
                          {user.status === 'active' ? 'On' : 'Off'}
                        </AdminBadge>
                      </td>
                      <td className={userTdClass}>{user.has_active_rules ? 'Yes' : 'No'}</td>
                      <td
                        className={userTdClass}
                        title={
                          user.upload_tier === 'unlimited' ? 'Unlimited uploads' : 'Limited uploads'
                        }
                      >
                        <AdminBadge
                          status={user.upload_tier === 'unlimited' ? 'active' : 'inactive'}
                        >
                          {user.upload_tier === 'unlimited' ? 'Unl' : 'Lim'}
                        </AdminBadge>
                      </td>
                      <td className={userTdClass}>
                        {user.upload_retained_file_count ?? 0}
                        {user.upload_limit_max_files != null
                          ? `/${user.upload_limit_max_files}`
                          : ''}
                      </td>
                      <td className={userTdClass}>
                        {user.upload_storage_formatted || '0 B'}
                        {user.upload_limit_storage_formatted
                          ? `/${user.upload_limit_storage_formatted}`
                          : ''}
                      </td>
                      <td className={userTdClass}>
                        {user.upload_tier === 'unlimited' ? (
                          <span className="text-muted dark:text-muted-dark">—</span>
                        ) : (
                          <AdminBadge status={user.over_quota ? 'inactive' : 'active'}>
                            {user.over_quota ? 'Over' : 'OK'}
                          </AdminBadge>
                        )}
                      </td>
                      <td className={userTdClass}>{user.db_size_formatted || '—'}</td>
                      <td className={`${userTdClass} text-muted dark:text-muted-dark`}>
                        {new Date(user.created_at).toLocaleDateString(undefined, {
                          year: '2-digit',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td
                        className={`${userTdClass} text-right`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleStatusChange(user.auth_id, user.status, e)}
                            className="text-xs font-medium text-accent hover:underline dark:text-accent-dark"
                            title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.status === 'active' ? 'Disable' : 'Enable'}
                          </button>
                          <ConfirmButton
                            onConfirm={(e) => handleDelete(user.auth_id, e)}
                            confirmText="Delete"
                            className="text-xs font-medium text-label-danger-text hover:underline dark:text-label-danger-text-dark"
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
