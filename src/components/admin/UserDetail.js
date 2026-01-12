'use client';

import { useState, useEffect } from 'react';
import adminApiClient from '@/utils/adminApiClient';
import useAdminStore from '@/store/adminStore';

export default function UserDetail({ user }) {
  const [databaseInfo, setDatabaseInfo] = useState(null);
  const [automationInfo, setAutomationInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const { updateUserStatus } = useAdminStore();

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
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">User Information</h3>
          <button
            onClick={handleStatusChange}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              user.status === 'active'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {user.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Auth ID</label>
            <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white break-all">{user.auth_id}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Key Name</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{user.key_name || 'N/A'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
            <p className="mt-1">
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  user.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {user.status}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Has Active Rules</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{user.has_active_rules ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {new Date(user.created_at).toLocaleString()}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Updated At</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">
              {new Date(user.updated_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Database Info */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">Loading database information...</p>
        </div>
      ) : databaseInfo ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Database Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Database Path</label>
              <p className="mt-1 text-sm font-mono text-gray-900 dark:text-white break-all">{databaseInfo.path}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Exists</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">{databaseInfo.exists ? 'Yes' : 'No'}</p>
            </div>
            {databaseInfo.exists && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Size</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{databaseInfo.size_formatted}</p>
                </div>
                {databaseInfo.table_counts && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Tables</label>
                    <div className="mt-1 space-y-1">
                      {Object.entries(databaseInfo.table_counts).map(([table, count]) => (
                        <p key={table} className="text-sm text-gray-900 dark:text-white">
                          {table}: {count !== null ? count : 'N/A'}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Automation Info */}
      {automationInfo && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Automation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Rules</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {automationInfo.statistics?.total_rules || 0}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Enabled Rules</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {automationInfo.statistics?.enabled_rules || 0}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Executions (7 days)</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {automationInfo.statistics?.total_executions || 0}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
