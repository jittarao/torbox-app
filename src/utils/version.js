import { TORBOX_MANAGER_VERSION } from '@/config/apiConstants';

/** App version shown in the UI (from package.json via next.config env). */
export function getVersion() {
  return TORBOX_MANAGER_VERSION;
}
