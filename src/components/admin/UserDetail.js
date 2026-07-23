'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import adminApiClient from '@/utils/adminApiClient';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import { AdminBadge, AdminCard, AdminLoading, AdminStatRow } from './AdminUi';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useAppAlert } from '@/hooks/useAppAlert';

function formatAdminDateTime(iso, locale) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale, { timeZone: 'UTC' });
}

export default function UserDetail({ user }) {
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [automationInfo, setAutomationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirmDialog({ cancelLabel: 'Cancel' });
  const { alert, AppAlert } = useAppAlert();
  const locale = useLocale();
  const { updateUserStatus, updateUserUploadTier } = useAdminStore(
    useShallow((s) => ({
      updateUserStatus: s.updateUserStatus,
      updateUserUploadTier: s.updateUserUploadTier,
    }))
  );

  useEffect(() => {
    let cancelled = false;

    const loadDetails = async () => {
      try {
        const [dbResult, autoResult] = await Promise.all([
          adminApiClient.getUserDatabase(user.auth_id),
          adminApiClient.getUserAutomation(user.auth_id),
        ]);
        if (cancelled) return;
        setDatabaseInfo(dbResult.database);
        setAutomationInfo(autoResult);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading user details:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (user) {
      loadDetails();
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleStatusChange = async () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUserStatus(user.auth_id, newStatus);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleTierChange = async (newTier) => {
    if (user.upload_tier === newTier) return;
    const label = newTier === 'unlimited' ? 'Unlimited' : 'Limited';
    if (!(await confirm(`Change upload tier to ${label}?`, { confirmLabel: 'Change' }))) return;
    try {
      const result = await updateUserUploadTier(user.auth_id, newTier);
      if (!result.success) {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-4">
      <AdminCard
        title="User information"
        action={
          <button
            type="button"
            onClick={handleStatusChange}
            className={
              user.status === 'active' ? 'ui-btn-ghost text-label-danger-text' : 'ui-btn-accent'
            }
          >
            {user.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <span className="text-sm text-muted dark:text-muted-dark">Auth ID</span>
            <p className="mt-1 break-all font-mono text-sm text-text dark:text-text-dark">
              {user.auth_id}
            </p>
          </div>
          <AdminStatRow label="Key name" value={user.key_name || 'N/A'} />
          <div className="flex items-center justify-between gap-4 text-sm md:col-span-2">
            <span className="text-muted dark:text-muted-dark">Status</span>
            <AdminBadge status={user.status === 'active' ? 'active' : 'inactive'}>
              {user.status}
            </AdminBadge>
          </div>
          <AdminStatRow label="Active rules" value={user.has_active_rules ? 'Yes' : 'No'} />
          <AdminStatRow label="Created" value={formatAdminDateTime(user.created_at, locale)} />
          <AdminStatRow label="Updated" value={formatAdminDateTime(user.updated_at, locale)} />
        </div>
      </AdminCard>

      {loading ? (
        <AdminLoading label="Loading database information…" />
      ) : databaseInfo ? (
        <AdminCard title="Database">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <span className="text-sm text-muted dark:text-muted-dark">Path</span>
              <p className="mt-1 break-all font-mono text-xs text-text dark:text-text-dark">
                {databaseInfo.path}
              </p>
            </div>
            <AdminStatRow label="Exists" value={databaseInfo.exists ? 'Yes' : 'No'} />
            {databaseInfo.exists ? (
              <>
                <AdminStatRow label="Size" value={databaseInfo.size_formatted} />
                {databaseInfo.table_counts ? (
                  <div className="md:col-span-2">
                    <span className="text-sm text-muted dark:text-muted-dark">Tables</span>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(databaseInfo.table_counts).map(([table, count]) => (
                        <li key={table} className="text-sm text-text dark:text-text-dark">
                          {table}: {count !== null ? count : 'N/A'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      <AdminCard
        title="Upload quota"
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTierChange('limited')}
              className={user.upload_tier !== 'unlimited' ? 'ui-btn-accent' : 'ui-btn-ghost'}
            >
              Limited
            </button>
            <button
              type="button"
              onClick={() => handleTierChange('unlimited')}
              className={user.upload_tier === 'unlimited' ? 'ui-btn-accent' : 'ui-btn-ghost'}
            >
              Unlimited
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-4 text-sm md:col-span-2">
            <span className="text-muted dark:text-muted-dark">Tier</span>
            <AdminBadge status={user.upload_tier === 'unlimited' ? 'active' : 'inactive'}>
              {user.upload_tier === 'unlimited' ? 'Unlimited' : 'Limited'}
            </AdminBadge>
          </div>
          <AdminStatRow
            label="Retained files"
            value={`${user.upload_retained_file_count ?? 0} / ${user.upload_limit_max_files ?? '—'}`}
          />
          <AdminStatRow
            label="Storage used"
            value={`${user.upload_storage_formatted || '0 B'} / ${user.upload_limit_storage_formatted || '—'}`}
          />
          <AdminStatRow
            label="Quota status"
            value={
              user.upload_tier === 'unlimited'
                ? 'N/A (unlimited)'
                : user.over_quota
                  ? 'Over quota'
                  : 'Within limits'
            }
          />
        </div>
      </AdminCard>

      {automationInfo ? (
        <AdminCard title="Automation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatRow label="Total rules" value={automationInfo.statistics?.total_rules || 0} />
            <AdminStatRow
              label="Enabled rules"
              value={automationInfo.statistics?.enabled_rules || 0}
            />
            <AdminStatRow
              label="Executions (7d)"
              value={automationInfo.statistics?.total_executions || 0}
            />
          </div>
        </AdminCard>
      ) : null}
      <ConfirmDialog />
      <AppAlert />
    </div>
  );
}
