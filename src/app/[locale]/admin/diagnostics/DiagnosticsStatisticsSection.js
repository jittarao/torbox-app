export default function DiagnosticsStatisticsSection({ statistics }) {
  return (
    <div className="rounded-xl border border-border/60 bg-white shadow-sm dark:border-border-dark/60 dark:bg-surface-alt-dark p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark mb-4">
        Statistics
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-medium text-muted dark:text-muted-dark mb-2">API Keys</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted dark:text-muted-dark">Total:</span>
              <span className="font-medium text-primary-text dark:text-primary-text-dark">
                {statistics.apiKeys.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted dark:text-muted-dark">Active:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {statistics.apiKeys.active}
              </span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-muted dark:text-muted-dark mb-2">
            User Registry
          </h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted dark:text-muted-dark">Total:</span>
              <span className="font-medium text-primary-text dark:text-primary-text-dark">
                {statistics.userRegistry.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted dark:text-muted-dark">Active:</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {statistics.userRegistry.active}
              </span>
            </div>
          </div>
        </div>
        {statistics.databaseFiles && (
          <div>
            <h4 className="text-sm font-medium text-muted dark:text-muted-dark mb-2">
              Database Files
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Total:</span>
                <span className="font-medium text-primary-text dark:text-primary-text-dark">
                  {statistics.databaseFiles.total}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Existing:</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {statistics.databaseFiles.existing}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Missing:</span>
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
            <h4 className="text-sm font-medium text-muted dark:text-muted-dark mb-2">
              Integrity Checks
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Checked:</span>
                <span className="font-medium text-primary-text dark:text-primary-text-dark">
                  {statistics.integrityChecks.checked} / {statistics.integrityChecks.total}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted dark:text-muted-dark">Failed:</span>
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
  );
}
