import { TORBOX_MANAGER_VERSION } from '@/components/constants';

/** App version shown in the UI (from package.json via next.config env). */
export function getVersion() {
  return TORBOX_MANAGER_VERSION;
}
