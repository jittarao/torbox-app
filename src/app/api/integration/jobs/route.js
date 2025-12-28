import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
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

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/integration/jobs`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      // Check if response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return NextResponse.json(
          {
            success: false,
            error: 'API endpoint not found or authentication failed',
            detail: 'The integration jobs endpoint returned an HTML error page',
          },
          { status: 404 },
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `API responded with status: ${response.status}`,
          detail: errorData.detail || 'Failed to fetch integration jobs',
        },
        { status: response.status },
      );
    }

    // Check if response is HTML (error page)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      return NextResponse.json(
        {
          success: false,
          error: 'API endpoint not found or authentication failed',
          detail: 'The integration jobs endpoint returned an HTML error page',
        },
        { status: 404 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching integration jobs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
