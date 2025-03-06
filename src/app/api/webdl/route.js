import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { headers } from 'next/headers';

// Get all web downloads
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const bypassCache = headersList.get('bypass-cache') === 'true';

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    // Fetch both regular and queued web downloads in parallel
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(
        `${API_BASE}/${API_VERSION}/api/webdl/mylist${bypassCache ? '?bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=webdl${bypassCache ? '&bypass_cache=true' : ''}`,
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
    console.error('Error fetching web download data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a web download
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 400 },
    );
  }

  try {
    const formData = await request.formData();

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/webdl/createwebdownload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          success: false,
          error:
            errorData.message ||
            `API responded with status: ${response.status}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating web download:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// Delete a web download item
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/webdl/controlwebdownload`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify({
          webdl_id: id,
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
