'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import adminApiClient from '@/utils/adminApiClient';

export default function AdminDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDiagnostics = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await adminApiClient.getDiagnostics();
        setDiagnostics(result);
      } catch (err) {
        console.error('Error loading diagnostics:', err);
        setError(err.message || 'Failed to load diagnostics');
      } finally {
        setLoading(false);
      }
    };
    loadDiagnostics();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      healthy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          colors[status] || colors.warning
        }`}
      >
        {status.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Running diagnostics...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Error: {error}</p>
        </div>
      </AdminLayout>
    );
  }

  if (!diagnostics) {
    return null;
  }

  const { statistics, issues, summary, activeUsersBreakdown, timestamp } = diagnostics;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Database Diagnostics</h2>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Summary</h3>
            {getStatusBadge(summary.status)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Total Issues
              </label>
              <p
                className={`mt-1 text-2xl font-bold ${
                  summary.totalIssues === 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {summary.totalIssues}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className={`mt-1 text-lg font-medium ${getStatusColor(summary.status)}`}>
                {summary.status}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Last Checked
              </label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {new Date(timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                API Keys
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {statistics.apiKeys.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Active:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {statistics.apiKeys.active}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                User Registry
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {statistics.userRegistry.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Active:</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {statistics.userRegistry.active}
                  </span>
                </div>
              </div>
            </div>
            {statistics.databaseFiles && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Database Files
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {statistics.databaseFiles.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Existing:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {statistics.databaseFiles.existing}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Missing:</span>
                    <span
                      className={`font-medium ${
                        statistics.databaseFiles.missing === 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {statistics.databaseFiles.missing}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {statistics.integrityChecks && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Integrity Checks
                </h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Checked:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {statistics.integrityChecks.checked} / {statistics.integrityChecks.total}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Failed:</span>
                    <span
                      className={`font-medium ${
                        statistics.integrityChecks.failed === 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {statistics.integrityChecks.failed}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Users Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Active Users Breakdown
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Users:</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {activeUsersBreakdown.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Both Active:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {activeUsersBreakdown.both_active}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Registry Active Only:</span>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                {activeUsersBreakdown.registry_active_only}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">API Key Active Only:</span>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                {activeUsersBreakdown.api_key_active_only}
              </span>
            </div>
          </div>
        </div>

        {/* Issues */}
        {summary.totalIssues > 0 && (
          <div className="space-y-4">
            {/* Orphaned API Keys */}
            {issues.orphanedApiKeys.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Orphaned API Keys ({issues.orphanedApiKeys.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  API keys without corresponding user registry entries
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.orphanedApiKeys.map((key, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {key.auth_id}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          Name: {key.key_name} | Created:{' '}
                          {new Date(key.created_at).toLocaleString()}
                          {key.is_active ? (
                            <span className="ml-2 text-green-600 dark:text-green-400">
                              (Active)
                            </span>
                          ) : (
                            <span className="ml-2 text-gray-500 dark:text-gray-400">
                              (Inactive)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orphaned Users */}
            {issues.orphanedUsers.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Orphaned User Registry Entries ({issues.orphanedUsers.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  User registry entries without corresponding API keys
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.orphanedUsers.map((user, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {user.auth_id}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          Path: {user.db_path}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          Status: {user.status} | Created:{' '}
                          {new Date(user.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate Auth IDs */}
            {issues.duplicateAuthIds.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
                  ❌ Duplicate Auth IDs ({issues.duplicateAuthIds.length}) - CRITICAL
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                  This should never happen due to PRIMARY KEY constraint
                </p>
                <div className="space-y-2">
                  {issues.duplicateAuthIds.map((dup, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
                    >
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        {dup.auth_id}
                      </div>
                      <div className="mt-1 text-red-700 dark:text-red-300">
                        Appears {dup.count} times
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duplicate DB Paths */}
            {issues.duplicateDbPaths.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
                  ❌ Duplicate DB Paths ({issues.duplicateDbPaths.length}) - CRITICAL
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                  This should never happen due to UNIQUE constraint
                </p>
                <div className="space-y-2">
                  {issues.duplicateDbPaths.map((dup, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
                    >
                      <div className="text-sm text-gray-700 dark:text-gray-300">{dup.db_path}</div>
                      <div className="mt-1 text-red-700 dark:text-red-300">
                        Appears {dup.count} times
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing Files */}
            {issues.missingFiles.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Missing Database Files ({issues.missingFiles.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Database files referenced in registry but not found on disk
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.missingFiles.slice(0, 20).map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {file.auth_id}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">{file.db_path}</div>
                      </div>
                    </div>
                  ))}
                  {issues.missingFiles.length > 20 && (
                    <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
                      ... and {issues.missingFiles.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Mismatches */}
            {issues.statusMismatches && issues.statusMismatches.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Status Mismatches ({issues.statusMismatches.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Users where API key status and registry status don't match
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.statusMismatches.map((mismatch, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {mismatch.auth_id}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          Registry: <span className="font-medium">{mismatch.registry_status}</span>{' '}
                          | API Key:{' '}
                          <span className="font-medium">
                            {mismatch.api_key_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          Key: {mismatch.key_name} | Created:{' '}
                          {new Date(mismatch.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Database Integrity Failures */}
            {issues.databaseIntegrityFailures && issues.databaseIntegrityFailures.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
                  ❌ Database Integrity Failures ({issues.databaseIntegrityFailures.length}) -
                  CRITICAL
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                  Databases that failed integrity checks. These may be corrupted.
                </p>
                {statistics.integrityChecks && (
                  <p className="text-xs text-red-700 dark:text-red-400 mb-3">
                    Checked {statistics.integrityChecks.checked} of{' '}
                    {statistics.integrityChecks.total} databases
                  </p>
                )}
                <div className="space-y-2">
                  {issues.databaseIntegrityFailures.map((failure, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
                    >
                      <div className="text-sm">
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {failure.auth_id}
                        </div>
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          {failure.db_path}
                        </div>
                        <div className="mt-1 text-red-700 dark:text-red-300 font-medium">
                          Error: {failure.error}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orphaned SQLite Files */}
            {issues.orphanedSqliteFiles && issues.orphanedSqliteFiles.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Orphaned SQLite Database Files ({issues.orphanedSqliteFiles.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Database files found on disk but not registered in the user registry
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.orphanedSqliteFiles.slice(0, 20).map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {file.filename}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {file.path}
                        </div>
                        <div className="mt-1 text-gray-600 dark:text-gray-400">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB | Modified:{' '}
                          {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {issues.orphanedSqliteFiles.length > 20 && (
                    <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
                      ... and {issues.orphanedSqliteFiles.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Orphaned WAL Files */}
            {issues.orphanedWalFiles && issues.orphanedWalFiles.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Orphaned WAL Files ({issues.orphanedWalFiles.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Write-Ahead Logging files found on disk but not associated with any registered
                  database
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.orphanedWalFiles.slice(0, 20).map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {file.filename}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {file.path}
                        </div>
                        <div className="mt-1 text-gray-600 dark:text-gray-400">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB | Modified:{' '}
                          {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {issues.orphanedWalFiles.length > 20 && (
                    <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
                      ... and {issues.orphanedWalFiles.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Orphaned SHM Files */}
            {issues.orphanedShmFiles && issues.orphanedShmFiles.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
                  ⚠️ Orphaned SHM Files ({issues.orphanedShmFiles.length})
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Shared Memory files found on disk but not associated with any registered database
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {issues.orphanedShmFiles.slice(0, 20).map((file, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
                    >
                      <div className="text-sm">
                        <div className="font-medium text-gray-700 dark:text-gray-300">
                          {file.filename}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {file.path}
                        </div>
                        <div className="mt-1 text-gray-600 dark:text-gray-400">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB | Modified:{' '}
                          {new Date(file.modified).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  {issues.orphanedShmFiles.length > 20 && (
                    <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
                      ... and {issues.orphanedShmFiles.length - 20} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* All Clear Message */}
        {summary.totalIssues === 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-2xl mr-3">✅</div>
              <div>
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-200">
                  All Systems Healthy
                </h3>
                <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                  No issues found. Database is consistent.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
