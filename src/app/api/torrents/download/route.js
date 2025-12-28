import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const torrentId = searchParams.get('torrent_id');
  const fileId = searchParams.get('file_id');
  const zipLink = searchParams.get('zip_link') === 'true';
  
  // Get user's IP address for CDN optimization
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const userIp = forwardedFor?.split(',')[0] || realIp || headersList.get('x-client-ip') || 'unknown';

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 400 },
    );
  }

  if (!torrentId) {
    return NextResponse.json(
      { success: false, error: 'Torrent ID is required' },
      { status: 400 },
    );
  }

  try {
    const queryParams = new URLSearchParams({
      token: apiKey,
      torrent_id: torrentId,
      ...(fileId && { file_id: fileId }),
      ...(zipLink && { zip_link: zipLink }),
      user_ip: userIp,
    });
    const apiUrl = `${API_BASE}/${API_VERSION}/api/torrents/requestdl?${queryParams}`;
    const response = await fetch(apiUrl, {
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
    console.error('Error fetching torrent download link:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
