import { Archive } from '@/components/icons';

export default function ArchivedDownloadsEmptyState({ archivedT, search }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 dark:border-border-dark dark:bg-surface-dark md:p-12">
      <div className="text-center">
        <Archive className="mx-auto mb-4 size-16 text-primary-text/40 dark:text-primary-text-dark/40" />
        <h2 className="mb-2 text-lg font-medium text-primary-text dark:text-primary-text-dark">
          {archivedT('emptyState.title')}
        </h2>
        <p className="mx-auto mb-4 max-w-2xl text-md text-primary-text/70 dark:text-primary-text-dark/70">
          {search ? archivedT('emptyState.noSearchResults') : archivedT('emptyState.description')}
        </p>
        {!search && (
          <div className="mt-6 rounded-lg border border-border bg-surface-alt p-4 dark:border-border-dark dark:bg-surface-alt-dark">
            <p className="mb-2 text-md text-primary-text/60 dark:text-primary-text-dark/60">
              <strong className="text-primary-text dark:text-primary-text-dark">
                {archivedT('emptyState.howItWorks')}
              </strong>
            </p>
            <ul className="mx-auto max-w-md space-y-1 text-left text-sm text-primary-text/60 dark:text-primary-text-dark/60">
              <li>• {archivedT('emptyState.step1')}</li>
              <li>• {archivedT('emptyState.step2')}</li>
              <li>• {archivedT('emptyState.step3')}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
