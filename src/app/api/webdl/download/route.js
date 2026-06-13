import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { isTorboxFetchTimeout, torboxFetch, TORBOX_TIMEOUT_ERROR } from '@/app/api/lib/torboxFetch';
import { sanitizeError } from '@/utils/sanitizeError';
export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const webId = searchParams.get('web_id');
  const fileId = searchParams.get('file_id');
  const zipLink = searchParams.get('zip_link') === 'true';

  // Get user's IP address for CDN optimization
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const userIp =
    forwardedFor?.split(',')[0] || realIp || headersList.get('x-client-ip') || 'unknown';

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
  }

  if (!webId) {
    return NextResponse.json(
      { success: false, error: 'Web download ID is required' },
      { status: 400 }
    );
  }

  try {
    const queryParams = new URLSearchParams({
      token: apiKey,
      web_id: webId,
      ...(fileId && { file_id: fileId }),
      ...(zipLink && { zip_link: zipLink }),
      user_ip: userIp,
    });
    const apiUrl = `${API_BASE}/${API_VERSION}/api/webdl/requestdl?${queryParams}`;
    const response = await torboxFetch(apiUrl, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching web download link:', error);
    if (isTorboxFetchTimeout(error)) {
      return NextResponse.json({ success: false, error: TORBOX_TIMEOUT_ERROR }, { status: 408 });
    }
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
