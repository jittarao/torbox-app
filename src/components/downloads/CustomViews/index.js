'use client';

import { useState } from 'react';
import Dropdown from '@/components/shared/Dropdown';

export default function CustomViews({
  views = [],
  activeView,
  onSelectView,
  onClearView,
  onEditView,
  onDeleteView,
}) {
  const [isManageOpen, setIsManageOpen] = useState(false);

  const viewOptions = views.map(view => ({
    label: view.name,
    value: view.id,
  }));

  if (views.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="text-xs font-medium text-primary-text/70 dark:text-primary-text-dark/70 whitespace-nowrap hidden sm:inline">
        View:
      </span>
      <Dropdown
        options={[
          { label: 'Default', value: null },
          ...viewOptions,
        ]}
        value={activeView?.id ?? null}
        onChange={(value) => {
          // Handle null value (string or actual null)
          if (value === null || value === 'null' || value === undefined) {
            onClearView();
            return;
          }
          
          // Convert to number if it's a string
          const viewId = typeof value === 'string' && !isNaN(value) ? parseInt(value, 10) : value;
          const view = views.find(v => v.id === viewId);
          
          if (view) {
            onSelectView(view);
          } else {
            console.warn('View not found for id:', viewId);
          }
        }}
        className="flex-1 sm:min-w-[140px] sm:flex-initial"
      />

      {/* Manage Views Button */}
      <button
        type="button"
        onClick={() => setIsManageOpen(true)}
        className="px-2 py-1 text-xs font-medium text-primary-text dark:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded-md border border-border dark:border-border-dark transition-colors flex items-center justify-center gap-1"
        title="Views"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
        <span className="hidden sm:inline">Views</span>
      </button>

      {/* Manage Views Modal */}
      {isManageOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsManageOpen(false)}
          />
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-surface dark:bg-surface-dark border border-border dark:border-border-dark rounded-lg shadow-xl w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-border-dark">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5 text-accent dark:text-accent-dark"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-primary-text dark:text-primary-text-dark">
                  Manage Views
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsManageOpen(false)}
                className="p-1 text-primary-text/70 dark:text-primary-text-dark/70 hover:text-primary-text dark:hover:text-primary-text-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark rounded transition-colors"
                title="Close"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {views.map((view) => {
                  const filterCount = view.filters?.groups
                    ? view.filters.groups.reduce((sum, g) => sum + (g.filters?.length || 0), 0)
                    : (Array.isArray(view.filters) ? view.filters.length : 0);
                  
                  return (
                    <div
                      key={view.id}
                      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-md transition-all ${
                        activeView?.id === view.id
                          ? 'border-accent dark:border-accent-dark bg-accent/5 dark:bg-accent-dark/5'
                          : 'border-border dark:border-border-dark hover:bg-surface-alt dark:hover:bg-surface-alt-dark'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="text-sm font-semibold text-primary-text dark:text-primary-text-dark truncate">
                            {view.name}
                          </h3>
                          {activeView?.id === view.id && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-accent dark:bg-accent-dark text-white rounded-full whitespace-nowrap">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-primary-text/60 dark:text-primary-text-dark/60">
                          {filterCount} filter{filterCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:ml-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectView(view);
                            setIsManageOpen(false);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-accent dark:text-accent-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 rounded-md border border-accent dark:border-accent-dark transition-colors flex-1 sm:flex-initial"
                        >
                          Apply
                        </button>
                        {onEditView && (
                          <button
                            type="button"
                            onClick={() => {
                              onEditView(view);
                              setIsManageOpen(false);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-primary-text dark:text-primary-text-dark hover:bg-surface dark:hover:bg-surface-dark rounded-md border border-border dark:border-border-dark transition-colors flex-1 sm:flex-initial"
                          >
                            Edit
                          </button>
                        )}
                        {onDeleteView && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete view "${view.name}"?`)) {
                                onDeleteView(view.id);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20 rounded-md border border-red-500/30 dark:border-red-500/30 transition-colors flex-1 sm:flex-initial"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
