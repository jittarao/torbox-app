'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import adminApiClient from '@/utils/adminApiClient';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';
import {
  AdminBadge,
  AdminCard,
  AdminEmpty,
  AdminFilterChip,
  AdminLoading,
  AdminSortableTh,
  adminCardClass,
  adminInputClass,
  adminRowHoverClass,
  adminTableClass,
  adminTheadClass,
} from './AdminUi';
import { formatLastSeen } from '@/utils/formatLastSeen';

const userThClass =
  'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-muted-dark lg:px-4';

const userTdClass = 'whitespace-nowrap px-3 py-2.5 text-sm text-text dark:text-text-dark lg:px-4';

function truncateAuthId(authId) {
  if (!authId) return '—';
  if (authId.length <= 18) return authId;
  return `${authId.slice(0, 10)}…${authId.slice(-6)}`;
}

const SORT_COLUMN_LABELS = {
  auth_id: 'Auth ID',
  key_name: 'Key',
  status: 'Status',
  has_active_rules: 'Rules',
  upload_tier: 'Tier',
  upload_retained_file_count: 'Files',
  upload_retained_storage_bytes: 'Storage',
  created_at: 'Created',
  last_seen_at: 'Last seen',
};

function formatSortLabel(sort, sortDirection) {
  const label = SORT_COLUMN_LABELS[sort] || 'Created';
  const dir = sortDirection === 'asc' ? 'ascending' : 'descending';
  return `${label} · ${dir}`;
}

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
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 dark:border-border-dark/40">
          <span className="text-xs font-medium uppercase tracking-wide text-muted dark:text-muted-dark">
            Activity
          </span>
          <AdminFilterChip active={!filters?.activity} onClick={() => onActivityFilter?.('all')}>
            All
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'online'}
            onClick={() => onActivityFilter?.('online')}
          >
            Online
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'today'}
            onClick={() => onActivityFilter?.('today')}
          >
            Active today
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'week'}
            onClick={() => onActivityFilter?.('week')}
          >
            Active this week
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'month'}
            onClick={() => onActivityFilter?.('month')}
          >
            Active this month
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'inactive30d'}
            onClick={() => onActivityFilter?.('inactive30d')}
          >
            Inactive &gt;30d
          </AdminFilterChip>
          <AdminFilterChip
            active={filters?.activity === 'dormant'}
            onClick={() => onActivityFilter?.('dormant')}
          >
            Dormant &gt;90d
          </AdminFilterChip>
        </div>
      </AdminCard>

      <div className={`${adminCardClass} overflow-hidden`}>
        {loading && users.length === 0 ? (
          <AdminLoading label="Loading users…" />
        ) : users.length === 0 ? (
          <AdminEmpty message="No users match your filters." />
        ) : (
          <div className={loading ? 'relative' : undefined}>
            {loading ? (
              <div
                className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center bg-white/40 pt-16 dark:bg-surface-alt-dark/50"
                aria-live="polite"
                aria-busy="true"
              >
                <div
                  className="size-6 animate-spin rounded-full border-2 border-border border-t-accent dark:border-border-dark dark:border-t-accent-dark"
                  role="status"
                  aria-label="Updating users…"
                />
              </div>
            ) : null}
            <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
              <table className={`${adminTableClass} w-full table-fixed`}>
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[6%]" />
                  <col className="w-[5%]" />
                  <col className="w-[6%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[5%]" />
                  <col className="w-[6%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className={adminTheadClass}>
                  <tr>
                    <AdminSortableTh
                      className={userThClass}
                      label="Auth ID"
                      sortKey="auth_id"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                      title="SHA-256 auth ID"
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Key"
                      sortKey="key_name"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Status"
                      sortKey="status"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Rules"
                      sortKey="has_active_rules"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                      title="Active automation rules"
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Tier"
                      sortKey="upload_tier"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                      title="Upload retention tier"
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Files"
                      sortKey="upload_retained_file_count"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                      title="Retained upload files"
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Storage"
                      sortKey="upload_retained_storage_bytes"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                      title="Retained upload storage"
                    />
                    <th className={userThClass} title="Upload quota status (not sortable)">
                      Quota
                    </th>
                    <th className={userThClass} title="Per-user database size (not sortable)">
                      DB
                    </th>
                    <AdminSortableTh
                      className={userThClass}
                      label="Created"
                      sortKey="created_at"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                    />
                    <AdminSortableTh
                      className={userThClass}
                      label="Last seen"
                      sortKey="last_seen_at"
                      activeSort={sort}
                      activeDirection={sortDirection}
                      onSort={onSort}
                    />
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
                      <td className={userTdClass}>
                        <span
                          className={
                            user.is_online
                              ? 'font-medium text-label-success-text dark:text-label-success-text-dark'
                              : undefined
                          }
                        >
                          {formatLastSeen(user.last_seen_at, { isOnline: user.is_online })}
                        </span>
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
                          <button
                            type="button"
                            onClick={(e) => handleDelete(user.auth_id, e)}
                            className="text-xs font-medium text-label-danger-text hover:underline disabled:opacity-50 dark:text-label-danger-text-dark"
                            disabled={deleting === user.auth_id}
                          >
                            {deleting === user.auth_id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination ? (
              <div className="flex flex-col gap-3 border-t border-border/60 bg-surface-alt px-4 py-3 dark:border-border-dark/60 dark:bg-surface-dark sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm text-muted dark:text-muted-dark">
                    Showing {(pagination.page - 1) * pagination.limit + 1}–
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total}
                  </p>
                  {onSort ? (
                    <p className="text-xs text-muted/80 dark:text-muted-dark/80">
                      Sorted by {formatSortLabel(sort, sortDirection)}
                    </p>
                  ) : null}
                </div>
                {pagination.totalPages > 1 ? (
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
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
      <ConfirmDialog />
      <AppAlert />
    </div>
  );
}
