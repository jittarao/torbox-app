import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const headersList = await headers();
  const apiKey =
    headersList.get('x-api-key') || request.nextUrl.searchParams.get('api_key');
  const torrentId = request.nextUrl.searchParams.get('torrent_id');
  const type = request.nextUrl.searchParams.get('type');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  if (!torrentId) {
    return NextResponse.json(
      { success: false, error: 'Torrent ID is required' },
      { status: 400 },
    );
  }

  if (!type || (type !== 'magnet' && type !== 'torrent')) {
    return NextResponse.json(
      { success: false, error: 'Valid type (magnet or torrent) is required' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/exportdata?torrent_id=${torrentId}&type=${type}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    // For magnet links, return JSON
    if (type === 'magnet') {
      const data = await response.json();
      return NextResponse.json(data);
    }

    // For torrent files, stream the response
    if (type === 'torrent') {
      const blob = await response.blob();

      // Create a new response with the blob data
      return new NextResponse(blob, {
        headers: {
          'Content-Type': 'application/x-bittorrent',
          'Content-Disposition': `attachment; filename="${torrentId}.torrent"`,
        },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
