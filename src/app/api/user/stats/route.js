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

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const general = searchParams.get('general') ?? 'false';
  const bandwidth = searchParams.get('bandwidth') ?? 'true';
  const bandwidthGrouping =
    searchParams.get('bandwidth_grouping') ?? 'week';

  const query = new URLSearchParams({
    general,
    bandwidth,
    bandwidth_grouping: bandwidthGrouping,
  });

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/user/stats?${query.toString()}`,
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
          error:
            errorData.error ||
            `API responded with status: ${response.status}`,
          detail: errorData.detail || 'Failed to fetch user stats',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
