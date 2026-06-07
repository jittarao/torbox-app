import { resolveTorboxApiKey } from './resolveTorboxApiKey';

/**
 * Require TorBox API key on internal Next.js API routes (x-api-key or Authorization: Bearer).
 * @returns {Promise<{ apiKey: string, response: null } | { apiKey: null, response: NextResponse }>}
 */
export async function requireTorboxApiKey() {
  return resolveTorboxApiKey();
}
