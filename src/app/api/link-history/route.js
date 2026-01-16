import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// GET /api/link-history - List link history
export async function GET(request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();

    // Forward query parameters
    if (searchParams.get('page')) params.append('page', searchParams.get('page'));
    if (searchParams.get('limit')) params.append('limit', searchParams.get('limit'));
    if (searchParams.get('search')) params.append('search', searchParams.get('search'));

    const url = new URL(`${BACKEND_URL}/api/link-history`);
    params.forEach((value, key) => url.searchParams.append(key, value));

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching link history:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/link-history - Create link history entry
export async function POST(request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/api/link-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating link history entry:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
