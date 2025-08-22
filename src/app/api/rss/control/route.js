import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const requestBody = await request.json();
    const { rss_feed_id, feed_id, operation } = requestBody;
    const actualFeedId = rss_feed_id || feed_id;

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false,
          error: 'API key is required' 
        },
        { status: 400 },
      );
    }

    if (!actualFeedId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Feed ID is required' 
        },
        { status: 400 },
      );
    }

    if (!operation) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Operation is required' 
        },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/rss/controlrss`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify({ rss_feed_id: actualFeedId, operation }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('RSS control API error:', data);
      return NextResponse.json(
        { 
          success: false,
          error: data.error || data.detail || 'Failed to control RSS feed' 
        },
        { status: response.status },
      );
    }

    return NextResponse.json({ 
      success: true, 
      data: data.data || data 
    });
  } catch (error) {
    console.error('Error controlling RSS feed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 },
    );
  }
}
