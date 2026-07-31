import { redirect } from 'next/navigation';
import { isSearchPageDisabled } from '@/utils/featureFlags';
import SearchPageClient from './SearchPageClient';

export const metadata = {
  title: 'Search — TorBox Manager',
  description:
    'Search streams from your Stremio addons by media ID and add torrents or NZBs to TorBox.',
};

export default async function SearchPage({ params }) {
  if (isSearchPageDisabled()) {
    const { locale } = await params;
    redirect(`/${locale}`);
  }

  return <SearchPageClient />;
}
