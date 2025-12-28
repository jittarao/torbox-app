import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/integration/googledrive`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify(body),
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
            detail: 'The Google Drive integration endpoint returned an HTML error page',
          },
          { status: 404 },
        );
      }
      
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || `API responded with status: ${response.status}`,
          detail: errorData.detail || 'Failed to upload to Google Drive',
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
          detail: 'The Google Drive integration endpoint returned an HTML error page',
        },
        { status: 404 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
