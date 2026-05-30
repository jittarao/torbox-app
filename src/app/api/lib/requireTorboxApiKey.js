import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Require x-api-key on Next.js API routes (TorBox user credential).
 * @returns {{ apiKey: string, response: null } | { apiKey: null, response: NextResponse }}
 */
export async function requireTorboxApiKey() {
  const apiKey = (await headers()).get('x-api-key');
  if (!apiKey) {
    return {
      apiKey: null,
      response: NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 401 }
      ),
    };
  }
  return { apiKey, response: null };
}
