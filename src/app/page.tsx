import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/settings';

export const metadata = {
  title: 'TorBox Manager',
  description: "A power user's alternative to TorBox UI. Built for speed and efficiency.",
};

export default function RootPage() {
  redirect(`/${defaultLocale}`);
}
