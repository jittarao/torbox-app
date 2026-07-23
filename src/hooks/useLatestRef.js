import { useEffect, useRef } from 'react';

/**
 * Keep a ref synced to the latest value without mutating during render.
 */
export function useLatestRef(value) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref;
}
