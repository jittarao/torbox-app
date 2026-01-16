import Icons from '@/components/icons';
import { useTranslations } from 'next-intl';

export default function EmptyState() {
  const linkHistoryT = useTranslations('LinkHistory');

  return (
    <div className="rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-8 md:p-12">
      <div className="text-center">
        <Icons.History className="w-16 h-16 mx-auto mb-4 text-primary-text/40 dark:text-primary-text-dark/40" />
        <h2 className="text-lg font-medium text-primary-text dark:text-primary-text-dark mb-2">
          {linkHistoryT('emptyState.title')}
        </h2>
        <p className="text-md text-primary-text/70 dark:text-primary-text-dark/70 max-w-xl mx-auto mb-4">
          {linkHistoryT('emptyState.description')}
        </p>
        <div className="mt-6 p-4 bg-surface-alt dark:bg-surface-alt-dark rounded-lg border border-border dark:border-border-dark">
          <p className="text-md text-primary-text/60 dark:text-primary-text-dark/60 mb-2">
            <strong className="text-primary-text dark:text-primary-text-dark">
              {linkHistoryT('emptyState.important')}
            </strong>
          </p>
          <ul className="text-sm text-primary-text/60 dark:text-primary-text-dark/60 text-left space-y-1 max-w-md mx-auto">
            <li>• {linkHistoryT('emptyState.step1')}</li>
            <li>• {linkHistoryT('emptyState.step2')}</li>
            <li>• {linkHistoryT('emptyState.step3')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
