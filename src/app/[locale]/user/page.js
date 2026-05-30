import UserPageClient from './UserPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'Account',
  'View your TorBox account, subscription, and referral settings.'
);

export default function UserPage() {
  return <UserPageClient />;
}
