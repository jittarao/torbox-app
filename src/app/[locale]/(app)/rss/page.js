import RssPageClient from './RssPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'RSS',
  'Subscribe to RSS feeds and automate downloads with TorBox.'
);

export default function RssPage() {
  return <RssPageClient />;
}
