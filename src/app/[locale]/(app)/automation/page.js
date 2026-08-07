import AutomationPageClient from './AutomationPageClient';
import { pageMetadata } from '@/utils/pageMetadata';

export const metadata = pageMetadata(
  'Automation',
  'Configure automation rules for your TorBox downloads.'
);

export default function AutomationPage() {
  return <AutomationPageClient />;
}
