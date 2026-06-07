import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export function resolveTorboxApiKeyFromHeaders(headersList) {
  const authorization = headersList.get('authorization');
  const bearerMatch = authorization?.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]?.trim()) {
    return bearerMatch[1].trim();
  }

  const apiKey = headersList.get('x-api-key');
  return apiKey?.trim() || null;
}

/**
 * Resolve TorBox API key from Authorization: Bearer or x-api-key.
 * @returns {Promise<{ apiKey: string, response: null } | { apiKey: null, response: NextResponse }>}
 */
export async function resolveTorboxApiKey() {
  const apiKey = resolveTorboxApiKeyFromHeaders(await headers());
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
