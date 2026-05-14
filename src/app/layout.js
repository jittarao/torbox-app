import { RybbitHeadScripts } from '@/components/RybbitHeadScripts';

export default function RootLayout({ children }) {
  return (
    <>
      <RybbitHeadScripts />
      {children}
    </>
  );
}
