import UploadsPageClient from './UploadsPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'Uploads',
  'Manage and monitor your TorBox upload queue.'
);

export default function UploadsPage() {
  return <UploadsPageClient />;
}
