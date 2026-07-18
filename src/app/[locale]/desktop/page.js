import DesktopPageClient from './DesktopPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'Settings',
  'Configure startup, secure sign-in, and background uploads for the TorBox Manager desktop app.'
);

export default function DesktopPage() {
  return <DesktopPageClient />;
}
