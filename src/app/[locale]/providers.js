'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, createContext, useContext } from 'react';

const PostHogClientContext = createContext(null);

function usePostHogClient() {
  return useContext(PostHogClientContext);
}

let posthogInitPromise = null;

function loadPostHog() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.__TBM_RYBBIT__) return Promise.resolve(null);
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return Promise.resolve(null);
  if (!posthogInitPromise) {
    posthogInitPromise = import('posthog-js').then((mod) => {
      const posthog = mod.default || mod.posthog;
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
      });
      return posthog;
    });
  }
  return posthogInitPromise;
}

export function PostHogProvider({ children }) {
  const [client, setClient] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadPostHog().then((posthog) => {
      if (!cancelled && posthog) {
        setClient(posthog);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PostHogClientContext.Provider value={client}>
      {client ? <SuspendedPostHogPageView /> : null}
      {children}
    </PostHogClientContext.Provider>
  );
}

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHogClient();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__TBM_RYBBIT__) {
      return;
    }
    if (pathname && posthog && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      let url = window.origin + pathname;
      if (searchParams.toString()) {
        url = url + '?' + searchParams.toString();
      }

      posthog.capture('$pageview', { $current_url: url });
    }
  }, [pathname, searchParams, posthog]);

  return null;
}

function SuspendedPostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
