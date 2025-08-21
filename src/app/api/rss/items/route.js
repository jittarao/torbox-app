import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feed_id');
  const offset = searchParams.get('offset') || '0';
  const limit = searchParams.get('limit') || '100';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  if (!feedId) {
    return NextResponse.json({ error: 'Feed ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/rss/getfeeditems?feed_id=${feedId}&offset=${offset}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching RSS feed items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
