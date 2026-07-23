import {
  AdminEmpty,
  AdminLoading,
  AdminSortableTh,
  adminCardClass,
  adminTableClass,
  adminTheadClass,
} from './AdminUi';
import UserListTableRow from './UserListTableRow';

const userThClass =
  'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-muted-dark lg:px-4';

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

export default function UserListTable({
  users,
  loading,
  pagination,
  sort,
  sortDirection,
  deleting,
  onUserClick,
  onPageChange,
  onSort,
  onStatusChange,
  onDelete,
}) {
  return (
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
                  <UserListTableRow
                    key={user.auth_id}
                    user={user}
                    deleting={deleting}
                    onUserClick={onUserClick}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                  />
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
  );
}
