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
  const userIp = searchParams.get('user_ip');
  const region = searchParams.get('region');
  const testLength = searchParams.get('test_length') || 'short';

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (userIp && userIp !== 'unknown') params.append('user_ip', userIp);
    if (region) params.append('region', region);
    if (testLength) params.append('test_length', testLength);

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/speedtest?${params}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `API responded with status: ${response.status}`,
          detail: errorData.detail || 'Failed to fetch speedtest data',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching speedtest data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
