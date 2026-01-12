export default function SystemOverview({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Memory Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Memory Usage</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">RSS</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.memory?.rss}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Heap Used</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.memory?.heapUsed}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Heap Total</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.memory?.heapTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Information</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Uptime</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.system?.uptimeFormatted || metrics.system?.uptime}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Node Version</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.system?.nodeVersion}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Platform</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.system?.platform}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Polling Scheduler */}
      {metrics.polling_scheduler && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Polling Scheduler</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className={`font-medium ${metrics.polling_scheduler.isRunning ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {metrics.polling_scheduler.isRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">Active Pollers</span>
                <span className="text-gray-900 dark:text-white font-medium">{metrics.polling_scheduler.activePollers || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Database</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Master DB</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.databases?.master_size_formatted || 'N/A'}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Total User DBs</span>
              <span className="text-gray-900 dark:text-white font-medium">{metrics.databases?.total_user_size_formatted || '0 MB'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
