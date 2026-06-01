import { AdminCard, AdminStatRow } from './AdminUi';

export default function PerformanceMetrics({ metrics }) {
  if (!metrics) return null;

  return (
    <AdminCard title="Performance">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.memory ? (
          <>
            <AdminStatRow label="RSS" value={metrics.memory.rss} />
            <AdminStatRow label="Heap used" value={metrics.memory.heapUsed} />
            <AdminStatRow label="Heap total" value={metrics.memory.heapTotal} />
          </>
        ) : null}
        {metrics.uptime_formatted ? (
          <AdminStatRow label="Uptime" value={metrics.uptime_formatted} />
        ) : null}
      </div>
    </AdminCard>
  );
}
