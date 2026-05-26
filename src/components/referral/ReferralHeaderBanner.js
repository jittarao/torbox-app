'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import ReferralCallout from '@/components/referral/ReferralCallout';

export default function ReferralHeaderBanner({ apiKey }) {
  const pathname = usePathname();
  const [promptFromQuery, setPromptFromQuery] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setPromptFromQuery(params.get('referral') === 'prompt');
  }, [pathname]);

  if (!apiKey || pathname?.includes('/admin')) {
    return null;
  }

  return (
    <ReferralCallout
      apiKey={apiKey}
      variant="slim"
      promptFromQuery={promptFromQuery}
    />
  );
}
