import { adminRowHoverClass } from './AdminUi';
import { formatLastSeen } from '@/utils/formatLastSeen';

const userTdClass = 'whitespace-nowrap px-3 py-2.5 text-sm text-text dark:text-text-dark lg:px-4';

function truncateAuthId(authId) {
  if (!authId) return '—';
  if (authId.length <= 18) return authId;
  return `${authId.slice(0, 10)}…${authId.slice(-6)}`;
}

export default function UserListTableRow({
  user,
  deleting,
  onUserClick,
  onStatusChange,
  onDelete,
}) {
  return (
    <tr
      onClick={() => onUserClick(user.auth_id)}
      className={`cursor-pointer bg-white dark:bg-surface-alt-dark ${adminRowHoverClass}`}
    >
      <td className={`${userTdClass} max-w-0 font-mono text-xs`} title={user.auth_id}>
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
        title={user.upload_tier === 'unlimited' ? 'Unlimited uploads' : 'Limited uploads'}
      >
        <AdminBadge status={user.upload_tier === 'unlimited' ? 'active' : 'inactive'}>
          {user.upload_tier === 'unlimited' ? 'Unl' : 'Lim'}
        </AdminBadge>
      </td>
      <td className={userTdClass}>
        {user.upload_retained_file_count ?? 0}
        {user.upload_limit_max_files != null ? `/${user.upload_limit_max_files}` : ''}
      </td>
      <td className={userTdClass}>
        {user.upload_storage_formatted || '0 B'}
        {user.upload_limit_storage_formatted ? `/${user.upload_limit_storage_formatted}` : ''}
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
      <td className={`${userTdClass} text-right`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={(e) => onStatusChange(user.auth_id, user.status, e)}
            className="text-xs font-medium text-accent hover:underline dark:text-accent-dark"
            title={user.status === 'active' ? 'Deactivate user' : 'Activate user'}
          >
            {user.status === 'active' ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            onClick={(e) => onDelete(user.auth_id, e)}
            className="text-xs font-medium text-label-danger-text hover:underline disabled:opacity-50 dark:text-label-danger-text-dark"
            disabled={deleting === user.auth_id}
          >
            {deleting === user.auth_id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}
