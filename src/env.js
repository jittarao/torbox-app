import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Typed environment (server + client). Validated when this module is loaded.
 * Set SKIP_ENV_VALIDATION=true to skip (e.g. one-off scripts).
 */
export const env = createEnv({
  server: {
    BACKEND_URL: z.string().optional(),
    BACKEND_DISABLED: z.string().optional(),
    SEARCH_PAGE_DISABLED: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_TORBOX_MANAGER_VERSION: z.string().optional(),
  },
  runtimeEnv: {
    BACKEND_URL: process.env.BACKEND_URL,
    BACKEND_DISABLED: process.env.BACKEND_DISABLED,
    SEARCH_PAGE_DISABLED: process.env.SEARCH_PAGE_DISABLED,
    NEXT_PUBLIC_TORBOX_MANAGER_VERSION: process.env.NEXT_PUBLIC_TORBOX_MANAGER_VERSION,
  },
  skipValidation: process.env.SKIP_ENV_VALIDATION === 'true',
});
