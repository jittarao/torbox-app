import { useSyncExternalStore } from 'react';

/** True after hydration; false during SSR. Avoids layout flash vs useState+useEffect. */
export default function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
