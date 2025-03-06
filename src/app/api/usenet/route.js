import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

// Get all usenet downloads
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const bypassCache = headersList.get('bypass-cache') === 'true';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    // Fetch both regular and queued usenet downloads in parallel
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(
        `${API_BASE}/${API_VERSION}/api/usenet/mylist${bypassCache ? '?bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=usenet${bypassCache ? '&bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
    ]);

    if (!downloadsResponse.ok || !queuedResponse.ok) {
      throw new Error(`API responded with status: ${downloadsResponse.status}`);
    }

    const [downloadsData, queuedData] = await Promise.all([
      downloadsResponse.json(),
      queuedResponse.json(),
    ]);

    // Merge the data
    const mergedData = {
      success: downloadsData.success && queuedData.success,
      data: [...(downloadsData.data || []), ...(queuedData.data || [])],
    };

    return NextResponse.json(mergedData);
  } catch (error) {
    console.error('Error fetching usenet data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a new usenet download
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/usenet/createusenetdownload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: formData,
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      return Response.json(
        {
          success: false,
          error: data.error,
          detail: data.detail || 'Failed to add NZB',
        },
        { status: response.status || 400 },
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// Delete a usenet item
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/usenet/controlusenetdownload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify({
          usenet_id: id,
          operation: 'delete',
        }),
      },
    );
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
