import { redirect } from 'next/navigation';
import { isSearchPageDisabled } from '@/utils/featureFlags';
import SearchPageClient from './SearchPageClient';

export default async function SearchPage({ params }) {
  if (isSearchPageDisabled()) {
    const { locale } = await params;
    redirect(`/${locale}`);
  }

  return <SearchPageClient />;
}
