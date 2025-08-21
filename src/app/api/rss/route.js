import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

// Get all RSS feeds
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/rss/getfeeds`,
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
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Add a new RSS feed
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action, ...feedData } = body;

    let endpoint;
    if (action === 'add') {
      endpoint = `${API_BASE}/${API_VERSION}/api/rss/addrss`;
    } else if (action === 'modify') {
      endpoint = `${API_BASE}/${API_VERSION}/api/rss/modifyrss`;
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "add" or "modify"' },
        { status: 400 },
      );
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body: JSON.stringify(feedData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || errorData.detail || 'Failed to process RSS feed',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing RSS feed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
