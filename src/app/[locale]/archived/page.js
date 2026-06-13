import ArchivedPageClient from './ArchivedPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata('Archives', 'Browse and restore archived TorBox downloads.');

export default function ArchivedDownloadsPage() {
  return <ArchivedPageClient />;
}
