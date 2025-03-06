import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { torrent_id, operation } = await request.json();

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/controltorrent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify({ torrent_id, operation }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.message },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
