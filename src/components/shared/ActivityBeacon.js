'use client';

import { useActivityBeacon } from '@/components/shared/hooks/useActivityBeacon';

/** Mounts the activity beacon hook once per app session. */
export default function ActivityBeacon() {
  useActivityBeacon();
  return null;
}
