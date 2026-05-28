import HomePageClient from './HomePageClient';

export const metadata = {
  title: 'TorBox Manager',
  description: 'Manage your TorBox downloads, torrents, and usenet files.',
};

export default function Home() {
  return <HomePageClient />;
}
