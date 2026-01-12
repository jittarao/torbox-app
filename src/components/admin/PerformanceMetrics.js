export default function PerformanceMetrics({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.memory && (
          <>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">RSS</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{metrics.memory.rss}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Heap Used</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{metrics.memory.heapUsed}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Heap Total</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{metrics.memory.heapTotal}</p>
            </div>
          </>
        )}
        {metrics.uptime_formatted && (
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">{metrics.uptime_formatted}</p>
          </div>
        )}
      </div>
    </div>
  );
}
