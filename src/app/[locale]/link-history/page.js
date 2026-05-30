import LinkHistoryPageClient from './LinkHistoryPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'Link History',
  'View your TorBox download link history.'
);

export default function LinkHistoryPage() {
  return <LinkHistoryPageClient />;
}
