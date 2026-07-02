import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { sanitizeError } from '@/utils/sanitizeError';
export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = new URLSearchParams();

  const wantsGeneral = searchParams.get('general') === 'true';
  const wantsBandwidth = searchParams.get('bandwidth') === 'true';

  // TorBox API expects opt-in flags (e.g. bandwidth=true). Sending general=false
  // causes UNKNOWN_ERROR; omit disabled sections instead (matches torbox.app).
  // general=true alone also fails — bandwidth responses include general stats.
  if (wantsBandwidth) {
    query.set('bandwidth', 'true');
    query.set('bandwidth_grouping', searchParams.get('bandwidth_grouping') ?? 'week');
  } else if (wantsGeneral) {
    query.set('bandwidth', 'true');
    query.set('bandwidth_grouping', 'week');
  }

  try {
    const response = await torboxFetch(
      `${API_BASE}/${API_VERSION}/api/user/stats?${query.toString()}`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `API responded with status: ${response.status}`,
          detail: errorData.detail || 'Failed to fetch user stats',
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
