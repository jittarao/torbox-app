'use client';

import { useState, useEffect } from 'react';
import adminApiClient from '@/utils/adminApiClient';
import { useShallow } from 'zustand/react/shallow';
import useAdminStore from '@/store/adminStore';
import { AdminBadge, AdminCard, AdminLoading, AdminStatRow } from './AdminUi';

export default function UserDetail({ user }) {
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [automationInfo, setAutomationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { updateUserStatus } = useAdminStore(
    useShallow((s) => ({ updateUserStatus: s.updateUserStatus }))
  );

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [dbResult, autoResult] = await Promise.all([
          adminApiClient.getUserDatabase(user.auth_id),
          adminApiClient.getUserAutomation(user.auth_id),
        ]);
        setDatabaseInfo(dbResult.database);
        setAutomationInfo(autoResult);
      } catch (error) {
        console.error('Error loading user details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadDetails();
    }
  }, [user]);

  const handleStatusChange = async () => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUserStatus(user.auth_id, newStatus);
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
          <AdminStatRow label="Created" value={new Date(user.created_at).toLocaleString()} />
          <AdminStatRow label="Updated" value={new Date(user.updated_at).toLocaleString()} />
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

      {automationInfo ? (
        <AdminCard title="Automation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AdminStatRow
              label="Total rules"
              value={automationInfo.statistics?.total_rules || 0}
            />
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
    </div>
  );
}
