function OrphanedApiKeysSection({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
        ⚠️ Orphaned API Keys ({items.length})
      </h3>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
        API keys without corresponding user registry entries
      </p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((key) => (
          <div
            key={key.auth_id}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-sm">
              <div className="font-mono text-xs text-muted dark:text-muted-dark">{key.auth_id}</div>
              <div className="mt-1 text-muted dark:text-muted-dark">
                Name: {key.key_name} | Created: {new Date(key.created_at).toLocaleString()}
                {key.is_active ? (
                  <span className="ml-2 text-green-600 dark:text-green-400">(Active)</span>
                ) : (
                  <span className="ml-2 text-muted dark:text-muted-dark">(Inactive)</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrphanedUsersSection({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
        ⚠️ Orphaned User Registry Entries ({items.length})
      </h3>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
        User registry entries without corresponding API keys
      </p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((user) => (
          <div
            key={user.auth_id}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-sm">
              <div className="font-mono text-xs text-muted dark:text-muted-dark">
                {user.auth_id}
              </div>
              <div className="mt-1 text-muted dark:text-muted-dark">Path: {user.db_path}</div>
              <div className="mt-1 text-muted dark:text-muted-dark">
                Status: {user.status} | Created: {new Date(user.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuplicateAuthIdsSection({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
        ❌ Duplicate Auth IDs ({items.length}) - CRITICAL
      </h3>
      <p className="text-sm text-red-800 dark:text-red-300 mb-3">
        This should never happen due to PRIMARY KEY constraint
      </p>
      <div className="space-y-2">
        {items.map((dup) => (
          <div
            key={dup.auth_id}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
          >
            <div className="font-mono text-xs text-muted dark:text-muted-dark">{dup.auth_id}</div>
            <div className="mt-1 text-red-700 dark:text-red-300">Appears {dup.count} times</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuplicateDbPathsSection({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
        ❌ Duplicate DB Paths ({items.length}) - CRITICAL
      </h3>
      <p className="text-sm text-red-800 dark:text-red-300 mb-3">
        This should never happen due to UNIQUE constraint
      </p>
      <div className="space-y-2">
        {items.map((dup) => (
          <div
            key={dup.db_path}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
          >
            <div className="text-sm text-muted dark:text-muted-dark">{dup.db_path}</div>
            <div className="mt-1 text-red-700 dark:text-red-300">Appears {dup.count} times</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingFilesSection({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
        ⚠️ Missing Database Files ({items.length})
      </h3>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
        Database files referenced in registry but not found on disk
      </p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.slice(0, 20).map((file) => (
          <div
            key={file.auth_id + '-' + file.db_path}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-sm">
              <div className="font-mono text-xs text-muted dark:text-muted-dark">
                {file.auth_id}
              </div>
              <div className="mt-1 text-muted dark:text-muted-dark">{file.db_path}</div>
            </div>
          </div>
        ))}
        {items.length > 20 && (
          <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
            ... and {items.length - 20} more
          </div>
        )}
      </div>
    </div>
  );
}

function StatusMismatchesSection({ items, repairLoading, onRepair }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200">
            ⚠️ Status Mismatches ({items.length})
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
            Users where API key status and registry status don&apos;t match
          </p>
        </div>
        <button
          type="button"
          onClick={onRepair}
          disabled={repairLoading}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {repairLoading ? 'Repairing…' : 'Repair'}
        </button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.map((mismatch) => (
          <div
            key={mismatch.auth_id}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-sm">
              <div className="font-mono text-xs text-muted dark:text-muted-dark">
                {mismatch.auth_id}
              </div>
              <div className="mt-1 text-muted dark:text-muted-dark">
                Registry: <span className="font-medium">{mismatch.registry_status}</span> | API Key:{' '}
                <span className="font-medium">
                  {mismatch.api_key_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-1 text-muted dark:text-muted-dark">
                Key: {mismatch.key_name} | Created: {new Date(mismatch.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabaseIntegrityFailuresSection({ items, integrityChecks }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-3">
        ❌ Database Integrity Failures ({items.length}) - CRITICAL
      </h3>
      <p className="text-sm text-red-800 dark:text-red-300 mb-3">
        Databases that failed integrity checks. These may be corrupted.
      </p>
      {integrityChecks && (
        <p className="text-xs text-red-700 dark:text-red-400 mb-3">
          Checked {integrityChecks.checked} of {integrityChecks.total} databases
        </p>
      )}
      <div className="space-y-2">
        {items.map((failure) => (
          <div
            key={failure.auth_id}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-red-200 dark:border-red-700"
          >
            <div className="text-sm">
              <div className="font-mono text-xs text-muted dark:text-muted-dark">
                {failure.auth_id}
              </div>
              <div className="mt-1 text-muted dark:text-muted-dark">{failure.db_path}</div>
              <div className="mt-1 text-red-700 dark:text-red-300 font-medium">
                Error: {failure.error}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrphanedDiskFilesSection({ title, description, items, totalCount }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-3">
        ⚠️ {title} ({items.length})
      </h3>
      <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">{description}</p>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {items.slice(0, 20).map((file) => (
          <div
            key={file.path}
            className="bg-white dark:bg-gray-800 rounded p-3 border border-yellow-200 dark:border-yellow-700"
          >
            <div className="text-sm">
              <div className="font-medium text-muted dark:text-muted-dark">{file.filename}</div>
              <div className="mt-1 text-xs text-muted dark:text-muted-dark">{file.path}</div>
              <div className="mt-1 text-muted dark:text-muted-dark">
                Size: {(file.size / 1024 / 1024).toFixed(2)} MB | Modified:{' '}
                {new Date(file.modified).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
        {totalCount > 20 && (
          <div className="text-sm text-yellow-800 dark:text-yellow-300 text-center pt-2">
            ... and {totalCount - 20} more
          </div>
        )}
      </div>
    </div>
  );
}

export default function DiagnosticsIssuesPanel({
  issues,
  statistics,
  summary,
  repairLoading,
  onRepairStatusMismatches,
}) {
  if (summary.totalIssues === 0) {
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      <OrphanedApiKeysSection items={issues.orphanedApiKeys} />
      <OrphanedUsersSection items={issues.orphanedUsers} />
      <DuplicateAuthIdsSection items={issues.duplicateAuthIds} />
      <DuplicateDbPathsSection items={issues.duplicateDbPaths} />
      <MissingFilesSection items={issues.missingFiles} />
      <StatusMismatchesSection
        items={issues.statusMismatches}
        repairLoading={repairLoading}
        onRepair={onRepairStatusMismatches}
      />
      <DatabaseIntegrityFailuresSection
        items={issues.databaseIntegrityFailures}
        integrityChecks={statistics.integrityChecks}
      />
      <OrphanedDiskFilesSection
        title={`Orphaned SQLite Database Files`}
        description="Database files found on disk but not registered in the user registry"
        items={issues.orphanedSqliteFiles}
        totalCount={issues.orphanedSqliteFiles?.length ?? 0}
      />
      <OrphanedDiskFilesSection
        title="Orphaned WAL Files"
        description="Write-Ahead Logging files found on disk but not associated with any registered database"
        items={issues.orphanedWalFiles}
        totalCount={issues.orphanedWalFiles?.length ?? 0}
      />
      <OrphanedDiskFilesSection
        title="Orphaned SHM Files"
        description="Shared Memory files found on disk but not associated with any registered database"
        items={issues.orphanedShmFiles}
        totalCount={issues.orphanedShmFiles?.length ?? 0}
      />
    </div>
  );
}
