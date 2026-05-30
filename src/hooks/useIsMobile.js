'use client';

import { useState, useLayoutEffect } from 'react';

const QUERY = '(max-width: 767px)';

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(QUERY).matches;
    }
    return false;
  });

  useLayoutEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
