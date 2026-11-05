import { History } from '@/components/icons';
import { useTranslations } from 'next-intl';
import EmptyStateCard from '@/components/shared/EmptyStateCard';

export default function EmptyState() {
  const linkHistoryT = useTranslations('LinkHistory');

  return (
    <EmptyStateCard
      icon={History}
      title={linkHistoryT('emptyState.title')}
      description={linkHistoryT('emptyState.description')}
      notesTitle={linkHistoryT('emptyState.important')}
      notes={[
        linkHistoryT('emptyState.step1'),
        linkHistoryT('emptyState.step2'),
        linkHistoryT('emptyState.step3'),
      ]}
    />
  );
}
