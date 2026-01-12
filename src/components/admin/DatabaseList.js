'use client';

import { useState } from 'react';
import adminApiClient from '@/utils/adminApiClient';

export default function DatabaseList({ databases }) {
  const [backingUp, setBackingUp] = useState(null);
  const [vacuuming, setVacuuming] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const handleBackup = async (authId) => {
    setBackingUp(authId);
    try {
      const result = await adminApiClient.backupDatabase(authId);
      // Show success message with option to download
      if (confirm(`Backup created successfully!\n\nSize: ${result.backup.size_formatted}\n\nWould you like to download it now?`)) {
        handleDownload(authId, result.backup.filename);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setBackingUp(null);
    }
  };

  const handleDownload = async (authId, filename) => {
    setDownloading(authId);
    try {
      let backupFilename = filename;

      // If no filename provided, get the latest backup
      if (!backupFilename) {
        const backupsResult = await adminApiClient.listBackups(authId);
        if (!backupsResult.success || !backupsResult.backups || backupsResult.backups.length === 0) {
          alert('No backups found for this user. Create a backup first.');
          setDownloading(null);
          return;
        }
        // Use the most recent backup (first in sorted list)
        backupFilename = backupsResult.backups[0].filename;
      }

      // Get download URL
      const downloadUrl = await adminApiClient.downloadBackup(authId, backupFilename);

      // Fetch the file as a blob
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backupFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Error downloading backup: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const handleVacuum = async (authId) => {
    if (!confirm('Are you sure you want to run VACUUM on this database? This may take a while.')) {
      return;
    }
    setVacuuming(authId);
    try {
      const result = await adminApiClient.vacuumDatabase(authId);
      alert(`Vacuum completed. Space freed: ${result.space_freed_formatted}`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setVacuuming(null);
    }
  };

  if (databases.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-400">No databases found</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Auth ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Exists
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {databases.map((db) => (
              <tr key={db.auth_id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-mono text-gray-900 dark:text-white">
                    {db.auth_id.substring(0, 16)}...
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      db.exists
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}
                  >
                    {db.exists ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">
                    {db.size_formatted || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleBackup(db.auth_id)}
                      disabled={!db.exists || backingUp === db.auth_id}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                    >
                      {backingUp === db.auth_id ? 'Backing up...' : 'Backup'}
                    </button>
                    <button
                      onClick={() => handleDownload(db.auth_id, null)}
                      disabled={!db.exists || downloading === db.auth_id}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                      title="Download latest backup (if available)"
                    >
                      {downloading === db.auth_id ? 'Downloading...' : 'Download'}
                    </button>
                    <button
                      onClick={() => handleVacuum(db.auth_id)}
                      disabled={!db.exists || vacuuming === db.auth_id}
                      className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                    >
                      {vacuuming === db.auth_id ? 'Vacuuming...' : 'Vacuum'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
