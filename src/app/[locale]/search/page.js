import { redirect } from 'next/navigation';
import { isSearchPageDisabled } from '@/utils/featureFlags';
import SearchPageClient from './SearchPageClient';

export const metadata = {
  title: 'Search — TorBox Manager',
  description:
    'Search and explore content available on TorBox. Find torrents, usenet, and direct downloads.',
};

export default async function SearchPage({ params }) {
  if (isSearchPageDisabled()) {
    const { locale } = await params;
    redirect(`/${locale}`);
  }

  return <SearchPageClient />;
}
