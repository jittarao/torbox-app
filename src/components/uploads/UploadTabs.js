import { STATUS_TABS } from './constants';

export default function UploadTabs({ activeTab, setActiveTab, statusCounts }) {
  return (
    <div className="border-b border-border dark:border-border-dark">
      <div className="flex gap-1">
        {STATUS_TABS.map((status) => {
          const count = statusCounts[status] || 0;
          const isActive = activeTab === status;
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                isActive
                  ? 'border-accent dark:border-accent-dark text-accent dark:text-accent-dark'
                  : 'border-transparent text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:border-border dark:hover:border-border-dark'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {count > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    isActive
                      ? 'bg-accent/20 dark:bg-accent-dark/20 text-accent dark:text-accent-dark'
                      : 'bg-surface-alt dark:bg-surface-alt-dark text-primary-text/70 dark:text-primary-text-dark/70'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
